const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts, fetchCurrentPrice, SerpApiError } = require('../services/serpApi');
const { validateExternalUrl } = require('../utils/urlSafety');

// Cooldown between paid-API price refreshes for the same product, prevents
// looping this endpoint across all product IDs to burn SerpApi quota.
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TITLE_LENGTH = 300;

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/products/search?q=<query>
// Searches Google Shopping via SerpApi and returns results (no auth required)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    const results = await searchProducts(q);
    res.json(results);
  } catch (err) {
    if (err instanceof SerpApiError) {
      // 4xx from the upstream provider (bad key, out of credits, rate limit)
      // is a service outage from our users' perspective, not a client error.
      // Surface it as 503 with a clean message instead of the raw axios text.
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/most-wishlisted
// Returns products with the most wishlist additions
router.get('/most-wishlisted', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        _count: { select: { wishlistItems: true } },
      },
      orderBy: { wishlistItems: { _count: 'desc' } },
      take: 8,
      where: { wishlistItems: { some: {} } },
    });
    res.json(products.map(p => ({ ...p, wishlistCount: p._count.wishlistItems })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/newest
// Returns the most recently added tracked products
router.get('/newest', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/best-value
// Returns products with highest discount % from their peak price
router.get('/best-value', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { highestPrice: { gt: 0 } },
      take: 50,
    });
    const withDiscount = products
      .map(p => ({
        ...p,
        discountPercent: Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100),
        savedAmount: parseFloat((p.highestPrice - p.currentPrice).toFixed(2)),
      }))
      .filter(p => p.discountPercent > 0)
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 8);
    res.json(withDiscount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/top-drops
// Returns tracked products with the biggest price drops (highest - current)
router.get('/top-drops', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { highestPrice: { gt: 0 } },
      include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 30 } },
      take: 50,
    });

    const withDrops = products
      .map(p => ({
        ...p,
        dropPercent: Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100),
        savedAmount: parseFloat((p.highestPrice - p.currentPrice).toFixed(2)),
      }))
      .filter(p => p.dropPercent > 0)
      .sort((a, b) => b.dropPercent - a.dropPercent)
      .slice(0, 8);

    res.json(withDrops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/deal-of-day
// Returns today's best deal (biggest % drop among wishlisted products)
router.get('/deal-of-day', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { highestPrice: { gt: 0 }, wishlistItems: { some: {} } },
      include: { _count: { select: { wishlistItems: true, likes: true } } },
      take: 100,
    });
    if (!products.length) return res.json(null);
    const scored = products
      .map(p => ({
        ...p,
        dropPercent: Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100),
        wishlistCount: p._count.wishlistItems,
        likeCount: p._count.likes,
        score: ((p.highestPrice - p.currentPrice) / p.highestPrice) * 100 + p._count.wishlistItems * 5,
      }))
      .filter(p => p.dropPercent > 0)
      .sort((a, b) => b.score - a.score);
    res.json(scored[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/related
// Returns products from same category/query
router.get('/:id/related', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Not found' });
    // Find products with overlapping keywords in serpApiQuery or title
    const words = product.serpApiQuery.split(' ').filter(w => w.length > 3);
    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        OR: words.slice(0, 3).map(w => ({ title: { contains: w, mode: 'insensitive' } })),
      },
      include: { _count: { select: { wishlistItems: true } } },
      take: 6,
    });
    res.json(related.map(p => ({ ...p, wishlistCount: p._count.wishlistItems })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/retailer-breakdown
// Returns the price history grouped to show retailer info (from source/url)
router.get('/:id/retailer-breakdown', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 30 } },
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    // Parse retailer from URL
    let retailer = 'Unknown';
    try { retailer = new URL(product.url || '').hostname.replace('www.', ''); } catch (_) {}
    res.json([{ retailer, currentPrice: product.currentPrice, lowestPrice: product.lowestPrice, currency: product.currency }]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/forecast
// Predicts the near-term price using least-squares linear regression over the
// product's price history and returns a buy-now-vs-wait recommendation.
router.get('/:id/forecast', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { priceHistory: { orderBy: { recordedAt: 'asc' } } },
    });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const hist = product.priceHistory;
    if (!hist || hist.length < 3) {
      return res.json({ enoughData: false, message: 'Not enough price history to forecast yet.' });
    }

    // x = days since first record, y = price
    const t0 = new Date(hist[0].recordedAt).getTime();
    const xs = hist.map(h => (new Date(h.recordedAt).getTime() - t0) / 86400000);
    const ys = hist.map(h => h.price);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const denom = n * sxx - sx * sx || 1;
    const slope = (n * sxy - sx * sy) / denom;          // price change per day
    const intercept = (sy - slope * sx) / n;

    // R^2 (confidence in the fit)
    const meanY = sy / n;
    const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0) || 1;
    const ssRes = ys.reduce((a, y, i) => a + (y - (intercept + slope * xs[i])) ** 2, 0);
    const r2 = Math.max(0, 1 - ssRes / ssTot);

    const cur = product.currentPrice;
    const lo = product.lowestPrice;
    const hi = product.highestPrice;
    const lastX = xs[n - 1];
    // Clamp extrapolations to a believable band around the historical range so
    // long-horizon linear projections don't run off to absurd values.
    const floor = Math.max(0, lo * 0.6);
    const ceil = hi * 1.4;
    const predict = (daysAhead) =>
      Math.min(ceil, Math.max(floor, intercept + slope * (lastX + daysAhead)));
    const predicted7d = parseFloat(predict(7).toFixed(2));
    const predicted30d = parseFloat(predict(30).toFixed(2));

    const position = hi > lo ? (cur - lo) / (hi - lo) : 0.5; // 0 = at lowest, 1 = at highest
    const dailyPct = cur > 0 ? (slope / cur) * 100 : 0;

    // Recommendation logic
    let action, reason, tone;
    if (cur <= lo * 1.02) {
      action = 'Buy now';
      reason = 'Price is at or near its lowest recorded level.';
      tone = 'buy';
    } else if (Math.abs(dailyPct) < 0.15) {
      // Near-flat price, judge purely on where it sits in the all-time range.
      action = position < 0.4 ? 'Good time' : 'Fair price';
      reason = 'Price has been stable recently with little movement expected.';
      tone = position < 0.4 ? 'buy' : 'neutral';
    } else if (slope < 0 && position > 0.35) {
      action = 'Wait';
      reason = `Price is trending down (~${Math.abs(dailyPct).toFixed(1)}%/day). It may fall further.`;
      tone = 'wait';
    } else if (slope > 0 && position < 0.55) {
      action = 'Buy soon';
      reason = 'Price is low but starting to rise. A good window may be closing.';
      tone = 'buy';
    } else {
      action = 'Wait';
      reason = 'Current price sits above its recent average.';
      tone = 'wait';
    }

    const confidence = Math.round((0.4 + 0.6 * r2) * Math.min(1, n / 8) * 100);

    res.json({
      enoughData: true,
      currency: product.currency,
      currentPrice: cur,
      predicted7d,
      predicted30d,
      trendPerDayPct: parseFloat(dailyPct.toFixed(2)),
      pricePosition: parseFloat((position * 100).toFixed(0)), // percentile within all-time range
      r2: parseFloat(r2.toFixed(2)),
      confidence,
      recommendation: { action, reason, tone },
      points: hist.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
// Returns a single product with its price history
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        priceHistory: { orderBy: { recordedAt: 'asc' } },
        _count: { select: { wishlistItems: true, likes: true, comments: true } },
      },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({
      ...product,
      wishlistCount: product._count.wishlistItems,
      likeCount: product._count.likes,
      commentCount: product._count.comments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory note of products whose source page yielded no image, to avoid
// re-fetching the same page on every miss.
const ogImageMisses = new Set();

function absolutize(u, base) {
  try { return new URL(u, base).href; } catch { return null; }
}

function extractOgImage(html, baseUrl) {
  const patterns = [
    /<meta[^>]+(?:property|name)=["\']og:image(?::secure_url|:url)?["\'][^>]*content=["\']([^"\']+)["\']/i,
    /<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']og:image["\']/i,
    /<meta[^>]+(?:property|name)=["\']twitter:image(?::src)?["\'][^>]*content=["\']([^"\']+)["\']/i,
    /<link[^>]+rel=["\']image_src["\'][^>]*href=["\']([^"\']+)["\']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const abs = absolutize(m[1].replace(/&amp;/g, '&'), baseUrl);
      if (abs) return abs;
    }
  }
  return null;
}

// GET /api/products/:id/og-image
// Resolves a real product photo for the product, caches it, and returns it.
// Strategy: (1) run a Google Shopping image search for the product so we get an
// actual photo of THIS product, (2) fall back to the linked page's og:image.
// Used by the frontend when the stored image won't load.
async function resolveFromShopping(product) {
  try {
    const query = product.serpApiQuery || product.title;
    const results = await searchProducts(query);
    // Prefer a result whose title resembles the product, else first with image.
    const key = product.title.toLowerCase().slice(0, 15);
    const match =
      results.find(r => r.imageUrl && r.title && r.title.toLowerCase().includes(key)) ||
      results.find(r => r.imageUrl);
    return match?.imageUrl || null;
  } catch {
    return null;
  }
}

async function resolveFromOg(product) {
  try {
    if (!product.url) return null;
    // Defensive re-check: product.url is validated at write time (from-search,
    // wishlist), but this guards against rows written before that validation
    // existed, or a hostname that has since been re-pointed at an internal
    // address (DNS rebinding), before we ever axios.get() it.
    const check = await validateExternalUrl(product.url);
    if (!check.valid) return null;
    const resp = await axios.get(product.url, {
      timeout: 7000,
      maxRedirects: 5,
      responseType: 'text',
      maxContentLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      validateStatus: (st) => st >= 200 && st < 400,
    });
    return extractOgImage(String(resp.data), product.url);
  } catch {
    return null;
  }
}

router.get('/:id/og-image', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (ogImageMisses.has(id)) return res.json({ imageUrl: null });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const imageUrl = (await resolveFromShopping(product)) || (await resolveFromOg(product));
    if (!imageUrl) { ogImageMisses.add(id); return res.json({ imageUrl: null }); }

    // Cache it so future loads are instant for everyone.
    await prisma.product.update({ where: { id }, data: { imageUrl } }).catch(() => {});
    res.json({ imageUrl });
  } catch (err) {
    ogImageMisses.add(parseInt(req.params.id));
    res.json({ imageUrl: null });
  }
});

// POST /api/products/:id/refresh
// Fetches the live price now, records a history point, and returns the updated
// product. Lets users build price history on demand instead of waiting for cron.
// Requires auth and a per-product cooldown, both to attach abuse to an
// account and to stop looping this across every product ID from burning
// paid SerpApi quota.
router.post('/:id/refresh', authMiddleware, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const msSinceChecked = Date.now() - new Date(product.lastChecked).getTime();
    if (msSinceChecked < REFRESH_COOLDOWN_MS) {
      const waitSec = Math.ceil((REFRESH_COOLDOWN_MS - msSinceChecked) / 1000);
      return res.status(429).json({ error: `This product was checked recently. Try again in ${waitSec}s.` });
    }

    let newPrice = null;
    try { newPrice = await fetchCurrentPrice(product.serpApiQuery, product.title); } catch (_) {}
    if (newPrice == null) {
      return res.status(200).json({ updated: false, message: 'Could not fetch a live price right now.' });
    }

    await prisma.priceHistory.create({ data: { productId: product.id, price: newPrice } });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        currentPrice: newPrice,
        lowestPrice: Math.min(product.lowestPrice, newPrice),
        highestPrice: Math.max(product.highestPrice, newPrice),
        lastChecked: new Date(),
      },
    });

    const fresh = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        priceHistory: { orderBy: { recordedAt: 'asc' } },
        _count: { select: { wishlistItems: true, likes: true, comments: true } },
      },
    });
    res.json({
      updated: true,
      product: {
        ...fresh,
        wishlistCount: fresh._count.wishlistItems,
        likeCount: fresh._count.likes,
        commentCount: fresh._count.comments,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/from-search
// Persists a product clicked from search results (if new) and returns it so the
// frontend can open the internal detail page. Public (anonymous search/browse
// is core to this app, see the many other unauthenticated GET routes above),
// but url/imageUrl are validated below to prevent this write path being used
// to plant an internal/private-network URL that a later fetch (og-image)
// would then request server-side (SSRF).
router.post('/from-search', async (req, res) => {
  try {
    const { title, url, imageUrl, serpApiQuery, currency } = req.body || {};
    const price = req.body.currentPrice ?? req.body.price;
    if (!title || price == null || !serpApiQuery)
      return res.status(400).json({ error: 'title, price, and serpApiQuery are required' });
    if (String(title).length > MAX_TITLE_LENGTH)
      return res.status(400).json({ error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` });

    if (url) {
      const check = await validateExternalUrl(url);
      if (!check.valid) return res.status(400).json({ error: `Invalid url: ${check.reason}` });
    }
    if (imageUrl && !String(imageUrl).startsWith('data:')) {
      const check = await validateExternalUrl(imageUrl);
      if (!check.valid) return res.status(400).json({ error: `Invalid imageUrl: ${check.reason}` });
    }

    let product = await prisma.product.findFirst({ where: { serpApiQuery, title } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          title,
          url: url || null,
          imageUrl: imageUrl || null,
          currentPrice: price,
          lowestPrice: price,
          highestPrice: price,
          currency: currency || 'USD',
          source: 'google_shopping',
          serpApiQuery,
        },
      });
      await prisma.priceHistory.create({ data: { productId: product.id, price } });
    }
    res.status(201).json({ id: product.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
