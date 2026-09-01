const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts, searchByBrands, fetchCurrentPrice, SerpApiError } = require('../services/serpApi');
const { matchCountry } = require('../services/countryBrands');
const { extractAttributes } = require('../services/productAttributes');
const { getReleaseStatus } = require('../services/productClassifier');
const { recordPrice } = require('../services/productPrice');
const { validateExternalUrl } = require('../utils/urlSafety');
const { diagnose } = require('../services/diagnostics');

// Cooldown between paid-API price refreshes for the same product, prevents
// looping this endpoint across all product IDs to burn SerpApi quota.
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TITLE_LENGTH = 300;

const router = express.Router();

// Inline data: image URIs. Only image MIME types, only a bounded length — the
// previous code skipped validation entirely for anything starting with
// `data:`, which let an unauthenticated caller store an arbitrary blob of any
// type or size that was then served to every viewer as an <img src>.
const MAX_DATA_IMAGE_LENGTH = 32 * 1024;
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)(;charset=[\w-]+)?(;base64)?,[A-Za-z0-9+/=%._~!$&'()*,;:@-]*$/i;

const prisma = new PrismaClient();

// GET /api/products/search?q=<query>
// Searches Google Shopping via SerpApi and returns results (no auth required)
router.get('/search', async (req, res) => {
  // Declared outside the try: the catch below reads it for the DB fallback and
  // for the admin diagnostic's context, and a `const` inside the try is not in
  // scope there — referencing it threw a ReferenceError from inside the error
  // handler, which crashed the process instead of answering the request.
  const { q } = req.query;
  try {
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    // A bare country name is a question about origin, not a product search.
    // Passed through literally it returns whatever the word also means —
    // "china" returned porcelain dinnerware — so it is answered with
    // electronics from that country's brands instead. Only an exact country
    // match is rewritten; "chinese phone case" stays the user's own query.
    const country = matchCountry(q);
    if (country) {
      const { results, brandsSearched } = await searchByBrands(country.brands);
      res.set('X-Search-Country', country.country);
      res.set('X-Search-Brands', brandsSearched.join(', '));
      res.set('Access-Control-Expose-Headers', 'X-Search-Country, X-Search-Brands');
      return res.json(results);
    }

    const results = await searchProducts(q);
    res.json(results);
  } catch (err) {
    if (err instanceof SerpApiError) {
      // The live search provider is down (bad key, no credits, rate limited).
      // Rather than a bare error page, fall back to already-tracked products
      // in our own database whose title matches the query, so the search
      // still returns something useful. These are marked `stale: true` so
      // the frontend can label them as cached/last-known prices.
      let fallback = [];
      try {
        const words = q.split(' ').filter(w => w.length > 2).slice(0, 4);
        const rows = await prisma.product.findMany({
          where: words.length
            ? { OR: words.map(w => ({ title: { contains: w, mode: 'insensitive' } })) }
            : {},
          take: 20,
        });
        fallback = rows.map(p => ({
          title: p.title,
          price: p.currentPrice,
          currency: p.currency,
          originalPrice: null,
          url: p.url,
          imageUrl: p.imageUrl,
          source: p.source,
          serpApiQuery: p.serpApiQuery,
          rating: null,
          reviews: null,
          stale: true,
          // Cached rows go through the same facet extraction as live ones,
          // so the sidebar filters work identically when search is degraded.
          ...extractAttributes(p.title),
        }));
      } catch (_) { /* DB fallback is best-effort; fall through to the 503 below if it fails too */ }

      if (fallback.length > 0) {
        // The body is a plain results array (the frontend's contract), so the
        // reason we are serving cached rows travels in headers. Without this
        // the UI could only say "temporarily unavailable", which hid the fact
        // that live search stays down until the provider account is topped up.
        res.set('X-Search-Degraded', '1');
        res.set('X-Search-Reason', String(err.message).replace(/[\r\n]+/g, ' '));
        if (req.isAdmin) {
          const d = diagnose(err, { method: req.method, path: req.originalUrl, query: q });
          res.set('X-Search-Diagnostic', Buffer.from(JSON.stringify(d)).toString('base64'));
        }
        res.set('Access-Control-Expose-Headers', 'X-Search-Degraded, X-Search-Reason, X-Search-Diagnostic');
        return res.json(fallback);
      }
      // 4xx from the upstream provider (bad key, out of credits, rate limit)
      // is a service outage from our users' perspective, not a client error.
      // Surface it as 503 with a clean message instead of the raw axios text.
      //
      // This route catches SerpApiError itself, so it never reaches the global
      // error handler and has to attach the admin diagnostic itself: without
      // this, an admin saw the same "try again later" line as everyone else
      // and had to read the server log to find out the key was rejected.
      const body = { error: err.message };
      if (req.isAdmin) {
        body.diagnostic = diagnose(err, { method: req.method, path: req.originalUrl, query: q });
      }
      return res.status(503).json(body);
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
      take: 24, // more than the homepage's PER_PAGE=4 shows at once, so there's actually something to page through
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
      take: 24,
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
      .slice(0, 24);
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
      .slice(0, 24);

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

// GET /api/products/public-stats
// Aggregate, non-identifying counts for homepage social proof. No user
// data, emails, or anything per-account — just totals.
router.get('/public-stats', async (req, res) => {
  try {
    const [productsTracked, activeTrackers, priceChecks, priceFields] = await Promise.all([
      prisma.product.count(),
      prisma.user.count(),
      prisma.priceHistory.count(),
      prisma.product.findMany({ select: { currentPrice: true, highestPrice: true } }),
    ]);
    const dropsRecorded = priceFields.filter(p => p.currentPrice < p.highestPrice).length;
    res.json({ productsTracked, activeTrackers, priceChecks, dropsRecorded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id/compare
// Compares this tracked product's price against other listings for the same
// search query (i.e. other retailers Google Shopping returned for it). We
// don't have a multi-retailer data model (one Product = one tracked
// listing), so rather than a schema rework this re-runs the same
// serpApiQuery the product was created from and surfaces the other results
// side by side, without merging them into the tracked product's own history.
// Cached in memory for a while per product since this burns paid API quota.
// --- Compare-listing matching -------------------------------------------
// The compare endpoint re-runs the product's original search query, which is
// often a broad category term ("smartphone"). Google Shopping happily returns
// entirely different products for that, and showing them next to the tracked
// price made the section claim a $599 phone was available for $10.42 — the
// $10.42 was a different, cheaper phone. These helpers keep only listings
// that actually look like the SAME product before anything is compared.

const COMPARE_STOPWORDS = new Set([
  'the','and','with','for','new','best','deal','deals','sale','free','plus',
  'unlocked','factory','refurb','refurbished','renewed','open','box','cell',
  'phone','smartphone','mobile','device','only','case','cover','plan','plans',
  'monthly','payments','payment','prepaid','carrier','contract','warranty',
  'shipping','official','genuine','original','brand','version','model',
]);

const ACCESSORY_RE = /\b(case|cover|sleeve|skin|screen protector|tempered glass|charger|charging cable|cable|adapter|dock|stand|mount|strap|band|bumper|holster|lens protector|carrying)\b/i;

// Used only to detect a CONFLICTING brand between two titles.
const KNOWN_BRANDS = new Set([
  'apple','samsung','sony','lg','dell','hp','lenovo','asus','acer','microsoft',
  'google','amazon','logitech','razer','canon','nikon','gopro','fitbit','garmin',
  'xiaomi','huawei','oneplus','motorola','moto','nokia','philips','panasonic',
  'intel','amd','nvidia','corsair','anker','belkin','jbl','bose','tcl','oukitel',
  'realme','oppo','vivo','honor','cricket',
]);

function compareTokens(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 2 && !COMPARE_STOPWORDS.has(t));
}

// Tokens that pin down a specific model: anything containing a digit
// ("s24", "15", "512gb", "wh1000xm5"). Two listings for the same product
// should agree on these; a different model number means a different product.
const hasDigit = t => /\d/.test(t);

// 0..1 — how confidently `candidate` is the same product as `tracked`.
function compareMatchScore(trackedTitle, candidateTitle) {
  const a = compareTokens(trackedTitle);
  const b = new Set(compareTokens(candidateTitle));
  if (a.length === 0 || b.size === 0) return 0;

  // Every model-identifying token in the tracked title must appear in the
  // candidate, otherwise it's a different model / capacity / generation.
  const modelTokens = a.filter(hasDigit);
  for (const t of modelTokens) {
    if (!b.has(t)) return 0;
  }

  // Accessories FOR the product ("... case", "... screen protector") share
  // almost all of the product's tokens and would otherwise score highly.
  // Reject them unless the tracked product is itself that accessory.
  if (ACCESSORY_RE.test(candidateTitle) && !ACCESSORY_RE.test(trackedTitle)) return 0;

  // Reject a candidate that names a DIFFERENT known brand. A candidate that
  // just omits the brand ("Pixel 9 Pro 256GB" for a tracked "Google Pixel 9
  // Pro 256GB") is still a valid listing, so a missing brand isn't fatal —
  // only a conflicting one is.
  const trackedBrand = a.find(t => KNOWN_BRANDS.has(t));
  const candidateBrand = compareTokens(candidateTitle).find(t => KNOWN_BRANDS.has(t));
  if (trackedBrand && candidateBrand && trackedBrand !== candidateBrand) return 0;

  const overlap = a.filter(t => b.has(t)).length;
  return overlap / a.length;
}

const COMPARE_MIN_SCORE = 0.5;
// A genuine listing for the same product shouldn't be a fraction of the
// tracked price — those are almost always monthly-instalment or
// accessory-for-that-product listings, not the product itself.
const COMPARE_MIN_PRICE_RATIO = 0.5;
const COMPARE_MAX_PRICE_RATIO = 2.5;

// Cache slots are keyed by product id, and product rows can be created by an
// unauthenticated request, so an unbounded Map here grows with whatever an
// attacker inserts and never releases a slot. These helpers cap the size and
// evict the oldest entries, so memory is bounded by the cap rather than by
// how many products exist.
const CACHE_MAX_ENTRIES = 500;

function cacheSet(map, key, value) {
  // Re-inserting moves the key to the end of the Map's insertion order, so
  // the first key is always the least recently written.
  map.delete(key);
  map.set(key, value);
  while (map.size > CACHE_MAX_ENTRIES) {
    map.delete(map.keys().next().value);
  }
}

function cacheGet(map, key, ttlMs) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= ttlMs) {
    map.delete(key);
    return null;
  }
  return hit;
}

const COMPARE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const compareCache = new Map(); // productId -> { at, listings }

router.get('/:id/compare', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const cached = cacheGet(compareCache, id, COMPARE_CACHE_TTL_MS);
    if (cached) return res.json({ listings: cached.listings, cached: true });

    let results = [];
    // techOnly:false — this product is already tracked (see searchProducts).
    try { results = await searchProducts(product.serpApiQuery, { techOnly: false }); } catch (_) { /* fall through with empty */ }

    // Exclude the exact listing already being tracked (same url, or same
    // title+price already shown as "currentPrice" above), dedupe by
    // retailer (source), and keep the cheapest result per retailer.
    const tracked = product.currentPrice;
    const bySource = new Map();
    for (const r of results) {
      if (!r.url || !r.source) continue;
      if (product.url && r.url === product.url) continue;
      if (!(r.price > 0)) continue;
      // Same product only — see compareMatchScore above.
      const score = compareMatchScore(product.title, r.title);
      if (score < COMPARE_MIN_SCORE) continue;
      if (tracked > 0) {
        const ratio = r.price / tracked;
        if (ratio < COMPARE_MIN_PRICE_RATIO || ratio > COMPARE_MAX_PRICE_RATIO) continue;
      }
      const existing = bySource.get(r.source);
      if (!existing || r.price < existing.price) bySource.set(r.source, { ...r, score });
    }
    const listings = Array.from(bySource.values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 8)
      .map(r => ({ title: r.title, price: r.price, currency: r.currency, url: r.url, source: r.source, imageUrl: r.imageUrl, rating: r.rating, matchScore: Math.round(r.score * 100) / 100 }));

    cacheSet(compareCache, id, { at: Date.now(), listings });
    res.json({ listings, cached: false });
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

function dropFromHighPct(high, current) {
  if (!(high > 0)) return 0;
  return Math.max(0, Math.round(((high - current) / high) * 100));
}

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

    // Recency-weighted least squares: recent price movement is a much better
    // signal of what happens next than a flat average over a product's whole
    // history (which can span months of an old, now-irrelevant trend). Weight
    // each point by an exponential decay from the most recent observation,
    // half-life 14 days, so a product that was trending down 3 months ago but
    // has been flat for the last 2 weeks correctly reads as "flat" now.
    const lastX = xs[n - 1];
    const HALF_LIFE_DAYS = 14;
    const weights = xs.map(x => Math.pow(0.5, (lastX - x) / HALF_LIFE_DAYS));
    const sw = weights.reduce((a, b) => a + b, 0);
    const swx = weights.reduce((a, w, i) => a + w * xs[i], 0);
    const swy = weights.reduce((a, w, i) => a + w * ys[i], 0);
    const swxx = weights.reduce((a, w, i) => a + w * xs[i] * xs[i], 0);
    const swxy = weights.reduce((a, w, i) => a + w * xs[i] * ys[i], 0);
    const denom = sw * swxx - swx * swx || 1;
    const slope = (sw * swxy - swx * swy) / denom;       // price change per day (recency-weighted)
    const intercept = (swy - slope * swx) / sw;

    // R^2 (confidence in the fit), computed weighted so it reflects fit
    // quality of the same recency-weighted line.
    const meanY = swy / sw;
    const ssTot = weights.reduce((a, w, i) => a + w * (ys[i] - meanY) ** 2, 0) || 1;
    const ssRes = weights.reduce((a, w, i) => a + w * (ys[i] - (intercept + slope * xs[i])) ** 2, 0);
    const r2 = Math.max(0, 1 - ssRes / ssTot);

    // Volatility = how much the price scatters AROUND the fitted trend.
    //
    // This used to be the coefficient of variation of the raw prices: the
    // unweighted standard deviation of the whole series divided by the
    // recency-weighted mean (two different quantities). A noiseless, perfectly
    // straight decline has a large raw SD by construction, so a textbook
    // downtrend of 1000 → 900 → 800 (r² = 1.0) measured 9.1% "volatility" and
    // the endpoint reported "volatile lately, without a clear up or down
    // trend" — the exact opposite of the truth.
    //
    // Measuring the residuals instead means a clean trend of any steepness has
    // near-zero volatility, and only genuine scatter softens the wording.
    const residualSd = Math.sqrt(ssRes / sw);
    const volatilityPct = meanY > 0 ? (residualSd / meanY) * 100 : 0;
    const highVolatility = volatilityPct > 8;

    const cur = product.currentPrice;
    const lo = product.lowestPrice;
    const hi = product.highestPrice;
    // Clamp extrapolations to a believable band around the historical range so
    // long-horizon linear projections don't run off to absurd values.
    const floor = Math.max(0, lo * 0.6);
    const ceil = hi * 1.4;
    // A clamped projection is not a prediction — it is the edge of the band.
    // Previously both horizons could be clamped to the same floor and returned
    // as if forecast: a 3-point history of 1000/900/800 projected to +100 at
    // 7 days and −2200 at 30, and the API reported "$480" for BOTH, a figure
    // 40% below the product's all-time low. Callers are now told when a value
    // was clamped so the UI can present it as a bound rather than a forecast.
    const project = (daysAhead) => {
      const raw = intercept + slope * (lastX + daysAhead);
      const clamped = Math.min(ceil, Math.max(floor, raw));
      return { value: parseFloat(clamped.toFixed(2)), clamped: clamped !== raw };
    };
    const p7 = project(7);
    const p30 = project(30);
    const predicted7d = p7.value;
    const predicted30d = p30.value;
    const predictionClamped = p7.clamped || p30.clamped;

    const position = hi > lo ? (cur - lo) / (hi - lo) : 0.5; // 0 = at lowest, 1 = at highest
    const dailyPct = cur > 0 ? (slope / cur) * 100 : 0;

    // Recommendation logic. Uses the recency-weighted trend above (so a stale
    // months-old downtrend doesn't outvote a genuinely flat last two weeks),
    // and softens wording when the price is too volatile for the trend to be
    // read with much confidence.
    const volatilityNote = highVolatility ? ' Price has swung noticeably recently, so treat this as a rough read.' : '';
    let action, reason, tone;
    if (cur <= lo * 1.02) {
      action = 'Buy now';
      reason = `Price is at or near its lowest recorded level (${dropFromHighPct(hi, cur)}% below its peak).`;
      tone = 'buy';
    } else if (Math.abs(dailyPct) < 0.15 || highVolatility) {
      // Near-flat recent trend, or too noisy to trust a slope at all — judge
      // purely on where it sits in the all-time range instead.
      action = position < 0.4 ? 'Good time' : 'Fair price';
      reason = (highVolatility
        ? 'Price has been volatile lately, without a clear up or down trend.'
        : 'Price has been stable recently with little movement expected.') + (position < 0.4 ? ' It also sits in the lower part of its historical range.' : '');
      tone = position < 0.4 ? 'buy' : 'neutral';
    } else if (slope < 0 && position > 0.35) {
      action = 'Wait';
      reason = `Price has been trending down recently (~${Math.abs(dailyPct).toFixed(1)}%/day). It may fall further.${volatilityNote}`;
      tone = 'wait';
    } else if (slope > 0 && position < 0.55) {
      action = 'Buy soon';
      reason = `Price is low but has started rising recently (~${dailyPct.toFixed(1)}%/day). A good window may be closing.${volatilityNote}`;
      tone = 'buy';
    } else {
      action = 'Wait';
      reason = `Current price sits above its recent average and is trending up (~${dailyPct.toFixed(1)}%/day).${volatilityNote}`;
      tone = 'wait';
    }

    // Confidence blends fit quality (r2), amount of history, and inverse
    // volatility — a noisy price series should never report high confidence
    // even if the weighted regression happens to fit those exact points well.
    const volatilityFactor = Math.max(0.4, 1 - volatilityPct / 40);
    const confidence = Math.round((0.4 + 0.6 * r2) * Math.min(1, n / 8) * volatilityFactor * 100);

    res.json({
      enoughData: true,
      currency: product.currency,
      currentPrice: cur,
      predicted7d,
      predicted30d,
      // True when a projection hit the plausible-range band and is therefore
      // a bound, not a forecast — the UI should say so rather than quote it.
      predictionClamped,
      trendPerDayPct: parseFloat(dailyPct.toFixed(2)),
      pricePosition: parseFloat((position * 100).toFixed(0)), // percentile within all-time range
      r2: parseFloat(r2.toFixed(2)),
      volatilityPct: parseFloat(volatilityPct.toFixed(1)),
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
    // Derived on read rather than stored: a pre-order becomes a released
    // product without anything about the row changing, so a persisted flag
    // would go stale silently. See services/productClassifier.
    const release = getReleaseStatus(product.title);
    res.json({
      ...product,
      wishlistCount: product._count.wishlistItems,
      likeCount: product._count.likes,
      commentCount: product._count.comments,
      released: release.released,
      releaseLabel: release.label,
      releaseReason: release.reason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory note of products whose source page yielded no image, to avoid
// re-fetching the same page on every miss.
// Was a plain Set with no expiry: a product with no image today was
// blacklisted for the entire process lifetime, even after a later /images
// call found one. Now it is a bounded, expiring cache like the others.
const OG_MISS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ogImageMisses = new Map(); // productId -> { at }

function absolutize(u, base) {
  try { return new URL(u, base).href; } catch { return null; }
}

// Pull the social-preview image URL out of a page.
//
// SECURITY: this parses a document fetched from a URL a user supplied, so the
// input is fully attacker-controlled. It used to run several regexes shaped
// like /<meta[^>]+...[^>]*content=.../ directly over the whole document. Two
// unbounded [^>] runs either side of a literal makes matching quadratic on
// input with many "<meta " tokens and no ">" — a 240 KB page measured ~4.4s
// PER PATTERN, and the fetch allows 5 MB, which is enough to wedge the single
// -threaded event loop indefinitely from one unauthenticated request.
//
// The fix is to never run a regex over the whole document: first slice out
// individual short tags with a bounded scan, then match within each tag. A
// tag longer than MAX_TAG_LENGTH is not a real meta tag and is skipped, which
// is what removes the unbounded run.
const MAX_TAG_LENGTH = 2000;
const MAX_TAGS_SCANNED = 5000;
const ATTR_RE = /([a-z:_-]+)\s*=\s*["']([^"']*)["']/gi;

function parseTagAttributes(tag) {
  const attrs = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

// Yields the text of each <meta>/<link> tag, bounded in both length and count.
function* headTags(html) {
  let from = 0;
  let scanned = 0;
  while (scanned < MAX_TAGS_SCANNED) {
    const open = html.indexOf('<', from);
    if (open === -1) return;
    const name = html.slice(open + 1, open + 6).toLowerCase();
    if (!name.startsWith('meta') && !name.startsWith('link')) {
      from = open + 1;
      continue;
    }
    // Bounded lookahead: indexOf stops at the cap instead of scanning on.
    const close = html.indexOf('>', open);
    if (close === -1) return;
    if (close - open <= MAX_TAG_LENGTH) {
      scanned++;
      yield html.slice(open, close + 1);
    }
    from = close + 1;
  }
}

const IMAGE_META_KEYS = ['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'];

function extractOgImage(html, baseUrl) {
  const found = { meta: null, link: null };
  for (const tag of headTags(html)) {
    const attrs = parseTagAttributes(tag);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (!found.meta && IMAGE_META_KEYS.includes(key) && attrs.content) {
      found.meta = attrs.content;
      break; // og:image is the best answer; stop as soon as we have one
    }
    if (!found.link && (attrs.rel || '').toLowerCase() === 'image_src' && attrs.href) {
      found.link = attrs.href;
    }
  }
  const raw = found.meta || found.link;
  if (!raw) return null;
  return absolutize(raw.replace(/&amp;/g, '&'), baseUrl);
}

// GET /api/products/:id/og-image
// Resolves a real product photo for the product, caches it, and returns it.
// Strategy: (1) run a Google Shopping image search for the product so we get an
// actual photo of THIS product, (2) fall back to the linked page's og:image.
// Used by the frontend when the stored image won't load.
async function resolveFromShopping(product) {
  try {
    const query = product.serpApiQuery || product.title;
    const results = await searchProducts(query, { techOnly: false });
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

// Redirect hops are followed by hand so each target can be re-validated;
// the body is capped both at fetch time and again before parsing.
const MAX_OG_REDIRECTS = 3;
const MAX_OG_BODY_BYTES = 2 * 1024 * 1024;
const MAX_OG_PARSE_BYTES = 512 * 1024;

async function resolveFromOg(product) {
  try {
    if (!product.url) return null;
    // Defensive re-check: product.url is validated at write time (from-search,
    // wishlist), but this guards against rows written before that validation
    // existed, or a hostname that has since been re-pointed at an internal
    // address (DNS rebinding), before we ever axios.get() it.
    // SSRF: every hop must be validated, not just the first.
    //
    // validateExternalUrl checks the protocol and resolves the host against
    // private/link-local ranges — but axios used to follow up to 5 redirects
    // internally, and those targets were never checked. A page on a public
    // host could simply answer `302 Location: http://169.254.169.254/...` and
    // the server would fetch it. So redirects are disabled and followed by
    // hand, re-validating each Location before the next request.
    let currentUrl = product.url;
    let resp = null;
    for (let hop = 0; hop <= MAX_OG_REDIRECTS; hop++) {
      const check = await validateExternalUrl(currentUrl);
      if (!check.valid) return null;

      resp = await axios.get(currentUrl, {
        timeout: 7000,
        maxRedirects: 0, // followed manually, see above
        responseType: 'text',
        maxContentLength: MAX_OG_BODY_BYTES,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        validateStatus: (st) => st >= 200 && st < 400,
      });

      if (resp.status < 300) break;

      const location = resp.headers?.location;
      if (!location) return null;
      const next = absolutize(location, currentUrl);
      if (!next) return null;
      currentUrl = next;
      resp = null;
    }
    if (!resp || resp.status >= 300) return null;

    // Only parse what actually claims to be HTML, and only the head-sized
    // prefix of it — the image metadata is always near the top.
    const contentType = String(resp.headers?.['content-type'] || '');
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) return null;
    return extractOgImage(String(resp.data).slice(0, MAX_OG_PARSE_BYTES), currentUrl);
  } catch {
    return null;
  }
}

// GET /api/products/:id/images
// A gallery of photos for this product, not just the one stored thumbnail.
// A single image is often a low-resolution retailer thumbnail, or a shot of
// the wrong colourway, so this collects every image the shopping search
// returned for listings that match THIS product (same brand and model — the
// same matcher the compare endpoint uses), plus the product page's og:image,
// deduped and capped. Cached in memory because it costs paid search quota.
const IMAGES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_GALLERY_IMAGES = 8;
const imagesCache = new Map(); // productId -> { at, images }

// Retailer thumbnails are frequently served at a fixed small size via query
// params; asking for a bigger one costs nothing and falls back gracefully.
function upscaleImageUrl(url) {
  try {
    const u = new URL(url);
    for (const [k, v] of [['w', '800'], ['h', '800'], ['wid', '800'], ['hei', '800'], ['sz', '800']]) {
      if (u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Two URLs can point at the same photo with different size params; compare on
// the path so near-duplicates collapse into one gallery entry.
function imageDedupeKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

router.get('/:id/images', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid product id' });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const cached = cacheGet(imagesCache, id, IMAGES_CACHE_TTL_MS);
    if (cached) return res.json({ images: cached.images, cached: true });

    const seen = new Set();
    const images = [];
    const add = (url) => {
      if (!url || typeof url !== 'string' || url.startsWith('data:')) return;
      const key = imageDedupeKey(url);
      if (seen.has(key)) return;
      seen.add(key);
      images.push(upscaleImageUrl(url));
    };

    // The stored image goes first so the gallery opens on the picture the
    // user already saw in search results.
    add(product.imageUrl);

    let results = [];
    try { results = await searchProducts(product.serpApiQuery || product.title, { techOnly: false }); } catch (_) { /* ignore */ }
    for (const r of results) {
      if (!r.imageUrl) continue;
      if (compareMatchScore(product.title, r.title) < COMPARE_MIN_SCORE) continue;
      add(r.imageUrl);
      if (images.length >= MAX_GALLERY_IMAGES) break;
    }

    // Still thin? The retailer page's own og:image is usually a large, clean
    // product shot, so it's worth the extra request when we have room.
    if (images.length < 2) {
      const og = await resolveFromOg(product);
      add(og);
    }

    const capped = images.slice(0, MAX_GALLERY_IMAGES);
    cacheSet(imagesCache, id, { at: Date.now(), images: capped });

    // Backfill the stored thumbnail if the product had none.
    if (!product.imageUrl && capped[0]) {
      await prisma.product.update({ where: { id }, data: { imageUrl: capped[0] } }).catch(() => {});
    }

    res.json({ images: capped, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/og-image', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid product id' });
    if (cacheGet(ogImageMisses, id, OG_MISS_TTL_MS)) return res.json({ imageUrl: null });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const imageUrl = (await resolveFromShopping(product)) || (await resolveFromOg(product));
    if (!imageUrl) { cacheSet(ogImageMisses, id, { at: Date.now() }); return res.json({ imageUrl: null }); }

    // Cache it so future loads are instant for everyone.
    await prisma.product.update({ where: { id }, data: { imageUrl } }).catch(() => {});
    res.json({ imageUrl });
  } catch (err) {
    const failedId = parseInt(req.params.id, 10);
    if (!Number.isNaN(failedId)) cacheSet(ogImageMisses, failedId, { at: Date.now() });
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

    await recordPrice(prisma, product, newPrice);

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
    if (imageUrl) {
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
    } else if (price > 0 && price !== product.currentPrice) {
      // The product already exists, but this request carries a price observed
      // just now by the live search. It used to be discarded: the detail page
      // kept showing a months-old figure and the fresh observation was lost.
      await recordPrice(prisma, product, price);
    }
    res.status(201).json({ id: product.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
