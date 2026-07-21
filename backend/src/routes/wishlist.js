const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts } = require('../services/serpApi');
const { validateExternalUrl } = require('../utils/urlSafety');

const router = express.Router();
const prisma = new PrismaClient();
const MAX_TITLE_LENGTH = 300;

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

    const dealScore = (p) => {
      if (p.highestPrice <= p.lowestPrice) return 50;
      return Math.round(((p.highestPrice - p.currentPrice) / (p.highestPrice - p.lowestPrice)) * 100);
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

    const totalCurrentValue = detailed.reduce((s, d) => s + d.currentPrice, 0);
    const totalSavedVsPeak = detailed.reduce((s, d) => s + d.savedVsPeak, 0);
    const alertsSet = detailed.filter(d => d.targetPrice != null).length;
    const targetsMet = detailed.filter(d => d.targetMet).length;
    const avgDealScore = detailed.length
      ? Math.round(detailed.reduce((s, d) => s + d.dealScore, 0) / detailed.length)
      : 0;
    const biggest = detailed.slice().sort((a, b) => b.dropPercent - a.dropPercent)[0] || null;

    const targetsHit = await prisma.notification.count({
      where: { userId: req.userId, type: { in: ['target_hit', 'price_drop'] } },
    });

    res.json({
      totalTracked: detailed.length,
      totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
      totalSavedVsPeak: parseFloat(totalSavedVsPeak.toFixed(2)),
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
    const { title, url, imageUrl, currentPrice, currency, serpApiQuery, targetPrice } = req.body;
    if (!title || currentPrice == null || !serpApiQuery)
      return res.status(400).json({ error: 'title, currentPrice, and serpApiQuery are required' });
    if (String(title).length > MAX_TITLE_LENGTH)
      return res.status(400).json({ error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` });

    // SSRF guard: reject urls/imageUrls that point at internal/private
    // network addresses before they can ever be persisted and later
    // fetched server-side (og-image fallback, price-drop emails).
    if (url) {
      const check = await validateExternalUrl(url);
      if (!check.valid) return res.status(400).json({ error: `Invalid url: ${check.reason}` });
    }
    if (imageUrl && !String(imageUrl).startsWith('data:')) {
      const check = await validateExternalUrl(imageUrl);
      if (!check.valid) return res.status(400).json({ error: `Invalid imageUrl: ${check.reason}` });
    }

    // Upsert the product
    let product = await prisma.product.findFirst({ where: { serpApiQuery, title } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          title,
          url: url || null,
          imageUrl: imageUrl || null,
          currentPrice,
          lowestPrice: currentPrice,
          highestPrice: currentPrice,
          currency: currency || 'USD',
          source: 'google_shopping',
          serpApiQuery,
        },
      });
      // Record initial price
      await prisma.priceHistory.create({
        data: { productId: product.id, price: currentPrice },
      });
    }

    // Create wishlist item (ignore if already exists)
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.userId, productId: product.id } },
      update: { targetPrice: targetPrice || null },
      create: { userId: req.userId, productId: product.id, targetPrice: targetPrice || null },
      include: { product: true },
    });

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
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
