const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const { checkPrices } = require('../jobs/priceCron');

const router = express.Router();
const prisma = new PrismaClient();

// Every route here requires a valid token AND an admin email.
router.use(authMiddleware, adminOnly);

const ALERT_TYPES = ['price_drop', 'target_hit', 'deal_alert'];

// GET /api/admin/stats, headline numbers + recent signups
router.get('/stats', async (req, res) => {
  try {
    const [users, products, wishlistItems, alertsSent, recentSignups] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.wishlistItem.count(),
      prisma.notification.count({ where: { type: { in: ALERT_TYPES } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
    ]);
    res.json({ users, products, wishlistItems, alertsSent, recentSignups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users, every registered user with their wishlist size
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        wishlistPublic: true,
        _count: { select: { wishlistItems: true } },
      },
    });
    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      wishlistPublic: u.wishlistPublic,
      wishlistCount: u._count.wishlistItems,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id, remove a user (cascades to their data)
router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (id === req.userId) return res.status(400).json({ error: 'You cannot delete your own admin account.' });

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/wishlist-visibility, hide/show a user from the public leaderboard & community wishlists
// without deleting their account. Body may include { wishlistPublic: boolean } to set it explicitly,
// otherwise the current value is toggled.
router.patch('/users/:id/wishlist-visibility', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, wishlistPublic: true } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const nextValue = typeof req.body?.wishlistPublic === 'boolean' ? req.body.wishlistPublic : !target.wishlistPublic;

    const updated = await prisma.user.update({
      where: { id },
      data: { wishlistPublic: nextValue },
      select: { id: true, wishlistPublic: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/products, most-wishlisted products + recent alerts
router.get('/products', async (req, res) => {
  try {
    const topProducts = await prisma.product.findMany({
      take: 10,
      orderBy: { wishlistItems: { _count: 'desc' } },
      select: {
        id: true,
        title: true,
        currentPrice: true,
        currency: true,
        imageUrl: true,
        _count: { select: { wishlistItems: true } },
      },
    });

    const recentAlerts = await prisma.notification.findMany({
      where: { type: { in: ALERT_TYPES } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    res.json({
      mostWishlisted: topProducts.map(p => ({
        id: p.id,
        title: p.title,
        currentPrice: p.currentPrice,
        currency: p.currency,
        imageUrl: p.imageUrl,
        wishlistCount: p._count.wishlistItems,
      })),
      recentAlerts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/check-prices, manually trigger the price-check cron job
// right now instead of waiting for the next scheduled run (dev/testing aid).
router.post('/check-prices', async (req, res) => {
  try {
    // Don't block the request on the full sweep (it can take a while and
    // hits an external API per product) — kick it off and report started.
    checkPrices().catch(err => console.error('[admin] manual price check failed:', err.message));
    res.json({ message: 'Price check started. Check the server logs and your notifications shortly.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
