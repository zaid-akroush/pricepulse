const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { searchProducts } = require('../services/serpApi');

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
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
// Returns a single product with its price history
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { priceHistory: { orderBy: { recordedAt: 'asc' } } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
