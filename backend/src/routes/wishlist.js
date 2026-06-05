const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts } = require('../services/serpApi');

const router = express.Router();
const prisma = new PrismaClient();

// All wishlist routes require authentication
router.use(authMiddleware);

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

    const updated = await prisma.wishlistItem.update({
      where: { id: item.id },
      data: { targetPrice: targetPrice ?? null },
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
