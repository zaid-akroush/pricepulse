const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/community/wishlists
// Returns all public wishlists grouped by user (no auth required)
router.get('/wishlists', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { wishlistItems: { some: {} } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        wishlistItems: {
          include: {
            product: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = users.map(u => ({
      userId: u.id,
      name: u.name,
      memberSince: u.createdAt,
      itemCount: u.wishlistItems.length,
      totalValue: u.wishlistItems.reduce((sum, i) => sum + i.product.currentPrice, 0),
      items: u.wishlistItems,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/community/leaderboard
// Returns users ranked by total wishlist value (most expensive wishlists)
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { wishlistItems: { some: {} } },
      select: {
        id: true,
        name: true,
        wishlistItems: {
          include: { product: { select: { currentPrice: true, currency: true } } },
        },
      },
    });

    const ranked = users
      .map(u => ({
        userId: u.id,
        name: u.name,
        itemCount: u.wishlistItems.length,
        totalValue: parseFloat(
          u.wishlistItems.reduce((sum, i) => sum + i.product.currentPrice, 0).toFixed(2)
        ),
        currency: u.wishlistItems[0]?.product.currency || 'USD',
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
