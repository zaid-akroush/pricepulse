const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts } = require('../services/serpApi');
const { validateExternalUrl } = require('../utils/urlSafety');
const { savingsTimeline, toUsd } = require('../services/analytics');
const { getRates } = require('../services/currency');
const { resolveMarket, isValidMarket } = require('../services/markets');
const { rescheduleProduct } = require('../jobs/priceCron');

const router = express.Router();

// Inline data: image URIs. Only image MIME types, only a bounded length — the
// previous code skipped validation entirely for anything starting with
// `data:`, which let an unauthenticated caller store an arbitrary blob of any
// type or size that was then served to every viewer as an <img src>.
const MAX_DATA_IMAGE_LENGTH = 32 * 1024;
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)(;charset=[\w-]+)?(;base64)?,[A-Za-z0-9+/=%._~!$&'()*,;:@-]*$/i;

const prisma = new PrismaClient();
const MAX_TITLE_LENGTH = 300;
const MAX_WISHLIST_ITEMS = 25; // per-user cap on tracked products

// All wishlist routes require authentication
router.use(authMiddleware);


// GET /api/wishlist/analytics
// Aggregate stats for the logged-in user's tracked products (dashboard).
router.get('/analytics', async (req, res) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: { product: { include: { priceHistory: { orderBy: { recordedAt: 'asc' } } } } },
    });
    // Products can now live in different markets (USD, HUF, EUR...). Totals
    // are summed in USD and reported as such; the client converts to the
    // display currency like any other price. Per-item figures stay in the
    // item's own currency.
    let rates = null;
    try { rates = (await getRates('USD')).rates; } catch (_) { /* sum unconverted */ }

    // Mirrors getDealScore in frontend/src/components/DealScore.jsx — keep the
    // two in step. Returns null (not a number) when there is no observed price
    // range to score against: a brand-new product has high === low, and the
    // old code asserted 50/100 for it, which is a made-up figure that also
    // dragged the dashboard's average away from the real one. Nulls are
    // excluded from the average below rather than counted as 50.
    const dealScore = (p) => {
      if (p.currentPrice == null || !p.highestPrice || p.highestPrice <= p.lowestPrice) return null;
      const range = p.highestPrice - p.lowestPrice;
      const saved = p.highestPrice - p.currentPrice;
      return Math.max(0, Math.min(100, Math.round((saved / range) * 100)));
    };

    const detailed = items.map(i => {
      const p = i.product;
      const savedVsPeak = Math.max(0, p.highestPrice - p.currentPrice);
      const toTarget = i.targetPrice != null ? p.currentPrice - i.targetPrice : null;
      return {
        id: i.id,
        productId: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        currency: p.currency,
        currentPrice: p.currentPrice,
        lowestPrice: p.lowestPrice,
        highestPrice: p.highestPrice,
        targetPrice: i.targetPrice,
        dropPercent: p.highestPrice > 0 ? Math.round(((p.highestPrice - p.currentPrice) / p.highestPrice) * 100) : 0,
        savedVsPeak: parseFloat(savedVsPeak.toFixed(2)),
        toTarget: toTarget != null ? parseFloat(toTarget.toFixed(2)) : null,
        dealScore: dealScore(p),
        targetMet: i.targetPrice != null && p.currentPrice <= i.targetPrice,
        priceHistory: p.priceHistory.map(h => ({ price: h.price, recordedAt: h.recordedAt })),
      };
    });

    const totalCurrentValue = detailed.reduce((s, d) => s + toUsd(d.currentPrice, d.currency, rates), 0);
    const totalSavedVsPeak = detailed.reduce((s, d) => s + toUsd(d.savedVsPeak, d.currency, rates), 0);
    const savings = savingsTimeline(items.map(i => i.product), 90, rates);
    const alertsSet = detailed.filter(d => d.targetPrice != null).length;
    const targetsMet = detailed.filter(d => d.targetMet).length;
    // Average only over products that HAVE a score. Including the nulls (or,
    // as before, counting an unscoreable product as 50) reports a number that
    // no product actually has.
    const scored = detailed.filter(d => d.dealScore != null);
    const avgDealScore = scored.length
      ? Math.round(scored.reduce((s, d) => s + d.dealScore, 0) / scored.length)
      : 0;
    const biggest = detailed.slice().sort((a, b) => b.dropPercent - a.dropPercent)[0] || null;

    const targetsHit = await prisma.notification.count({
      where: { userId: req.userId, type: { in: ['target_hit', 'price_drop'] } },
    });

    res.json({
      totalTracked: detailed.length,
      totalsCurrency: 'USD',
      totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
      totalSavedVsPeak: parseFloat(totalSavedVsPeak.toFixed(2)),
      savingsTimeline: savings,
      alertsSet,
      targetsMet,
      targetsHit,
      avgDealScore,
      biggestDrop: biggest,
      items: detailed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/wishlist
// Returns all wishlist items for the logged-in user
router.get('/', async (req, res) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: {
        product: { include: { priceHistory: { orderBy: { recordedAt: 'desc' }, take: 10 } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/wishlist
// Adds a product to the wishlist (creates product record if it doesn't exist)
router.post('/', async (req, res) => {
  try {
    const { title, url, imageUrl, serpApiQuery, targetPrice } = req.body;
    const currentPrice = Number(req.body.currentPrice);
    // Tracking a product that already exists (from its detail page) is done by
    // id, so it is never re-resolved by title/query/market and cannot end up
    // as a second row in a different market.
    const productId = req.body.productId != null ? Number(req.body.productId) : null;
    if (productId != null && (!Number.isInteger(productId) || productId <= 0))
      return res.status(400).json({ error: 'Invalid productId' });
    // Plain strings only: an object here would be passed to Prisma as a
    // filter ({ contains: '' }) and match an arbitrary product.
    // With a productId nothing else about the product is taken from the
    // client, so the listing fields are only required (and validated) when
    // the product has to be created from them.
    if (productId == null) {
      if (typeof title !== 'string' || typeof serpApiQuery !== 'string'
          || (url != null && typeof url !== 'string') || (imageUrl != null && typeof imageUrl !== 'string'))
        return res.status(400).json({ error: 'title, url, imageUrl and serpApiQuery must be strings' });
      if (!title || !Number.isFinite(currentPrice) || currentPrice <= 0 || !serpApiQuery)
        return res.status(400).json({ error: 'title, currentPrice, and serpApiQuery are required' });
      if (serpApiQuery.length > MAX_TITLE_LENGTH)
        return res.status(400).json({ error: `serpApiQuery must be ${MAX_TITLE_LENGTH} characters or fewer` });
    }
    // Currency follows the market the listing came from; see products.js.
    if (req.body.country != null && !isValidMarket(req.body.country))
      return res.status(400).json({ error: 'Unknown country' });
    const market = resolveMarket(req.body.country);
    if (productId == null && title.length > MAX_TITLE_LENGTH)
      return res.status(400).json({ error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` });

    // SSRF guard: reject urls/imageUrls that point at internal/private
    // network addresses before they can ever be persisted and later
    // fetched server-side (og-image fallback, price-drop emails).
    if (productId == null && url) {
      const check = await validateExternalUrl(url);
      if (!check.valid) return res.status(400).json({ error: `Invalid url: ${check.reason}` });
    }
    if (productId == null && imageUrl) {
      // The `data:` exemption that used to sit here let an unauthenticated
      // caller store an arbitrary, unvalidated data: URI of any size and any
      // type, which was then served to every viewer as an <img src>. The
      // seed script generates small data: SVG placeholders, so those are
      // allowed — but only that shape, and only within a size cap.
      const value = String(imageUrl);
      if (value.startsWith('data:')) {
        // Must be an image type, base64 or percent-encoded (the seed's SVG
        // placeholders are percent-encoded), and within the size cap.
        if (!DATA_IMAGE_RE.test(value) || value.length > MAX_DATA_IMAGE_LENGTH) {
          return res.status(400).json({ error: 'Invalid imageUrl' });
        }
      } else {
        const check = await validateExternalUrl(imageUrl);
        if (!check.valid) return res.status(400).json({ error: `Invalid imageUrl: ${check.reason}` });
      }
    }

    // Upsert the product
    let product = productId != null
      ? await prisma.product.findUnique({ where: { id: productId } })
      : await prisma.product.findFirst({ where: { serpApiQuery, title, country: market.code } });
    if (productId != null && !product) return res.status(404).json({ error: 'Product not found' });
    if (!product) {
      product = await prisma.product.create({
        data: {
          title,
          url: url || null,
          imageUrl: imageUrl || null,
          currentPrice,
          lowestPrice: currentPrice,
          highestPrice: currentPrice,
          currency: market.currency,
          country: market.code,
          source: 'google_shopping',
          serpApiQuery,
        },
      });
      // Record initial price
      await prisma.priceHistory.create({
        data: { productId: product.id, price: currentPrice },
      });
    }

    // Enforce a per-user wishlist cap. Only blocks genuinely NEW items —
    // re-adding/updating the target price on a product already tracked by
    // this user doesn't count against the limit, since it isn't growing
    // their list.
    const alreadyTracked = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: req.userId, productId: product.id } },
    });
    if (!alreadyTracked) {
      const trackedCount = await prisma.wishlistItem.count({ where: { userId: req.userId } });
      if (trackedCount >= MAX_WISHLIST_ITEMS) {
        return res.status(400).json({
          error: `You can track up to ${MAX_WISHLIST_ITEMS} products at once. Remove something from your wishlist to add a new one.`,
        });
      }
    }

    // Create wishlist item (ignore if already exists)
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.userId, productId: product.id } },
      update: { targetPrice: targetPrice || null },
      create: { userId: req.userId, productId: product.id, targetPrice: targetPrice || null },
      include: { product: true },
    });

    // A new tracker changes how often the product should be checked.
    if (!alreadyTracked) await rescheduleProduct(product.id).catch(() => {});

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/wishlist/:id
// Updates target price for a wishlist item
router.patch('/:id', async (req, res) => {
  try {
    const { targetPrice } = req.body;
    const item = await prisma.wishlistItem.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
    });
    if (!item) return res.status(404).json({ error: 'Wishlist item not found' });

    const { targetDropPercent } = req.body;
    const updated = await prisma.wishlistItem.update({
      where: { id: item.id },
      data: {
        targetPrice: targetPrice ?? null,
        ...(targetDropPercent !== undefined ? { targetDropPercent: targetDropPercent ?? null } : {}),
      },
      include: { product: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/wishlist/:id
// Removes a product from the wishlist
router.delete('/:id', async (req, res) => {
  try {
    const item = await prisma.wishlistItem.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
    });
    if (!item) return res.status(404).json({ error: 'Wishlist item not found' });

    await prisma.wishlistItem.delete({ where: { id: item.id } });
    // Fewer trackers may mean the product no longer needs frequent checks.
    await rescheduleProduct(item.productId).catch(() => {});
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
