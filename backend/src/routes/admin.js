const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const { checkPrices } = require('../jobs/priceCron');
const { looksLikeUnlabelledPayment } = require('../services/paymentTerms');
const { reconcileAggregates } = require('../services/productPrice');

const router = express.Router();
const prisma = new PrismaClient();

// Every route here requires a valid token AND an admin email.
router.use(authMiddleware, adminOnly);

const ALERT_TYPES = ['price_drop', 'target_hit', 'deal_alert'];

// GET /api/admin/stats, headline numbers + recent signups
router.get('/stats', async (req, res) => {
  try {
    const [users, products, wishlistItems, alertsSent, recentSignups, dueNow, intervals] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.wishlistItem.count(),
      prisma.notification.count({ where: { type: { in: ALERT_TYPES } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      prisma.product.count({ where: { nextCheckAt: { lte: new Date() } } }),
      prisma.product.groupBy({ by: ['checkIntervalHours'], _count: { _all: true }, orderBy: { checkIntervalHours: 'asc' } }),
    ]);
    // Expected provider requests per day under the adaptive schedule, versus
    // the old fixed six-hourly sweep, so the saving is visible on the dashboard.
    const schedule = intervals.map(g => ({ hours: g.checkIntervalHours, products: g._count._all }));
    const requestsPerDay = Math.round(schedule.reduce((sum, g) => sum + g.products * (24 / g.hours), 0));
    res.json({
      users, products, wishlistItems, alertsSent, recentSignups,
      schedule: { dueNow, intervals: schedule, requestsPerDay, fixedSixHourlyRequestsPerDay: products * 4 },
    });
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
    // `all` re-checks every product regardless of its schedule (costs one
    // provider request per distinct query); the default only runs what is due.
    const all = req.body && req.body.all === true;
    checkPrices({ all }).catch(err => console.error('[admin] manual price check failed:', err.message));
    res.json({ message: `Price check started (${all ? 'all products' : 'due products only'}). Check the server logs and your notifications shortly.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/repair-prices
//
// Deletes history rows that are instalment figures rather than prices, and
// recomputes each affected product's aggregates from what is left.
//
// The guard in services/productPrice stops new ones being written, but rows
// recorded before it existed are still there, and they are permanent damage
// on their own: lowestPrice is a number nobody can buy the product for, and
// "% below peak" and the deal score are computed from it, so the product sits
// at the top of every deal list forever.
//
// Dry run by default. Pass { apply: true } to actually delete.
router.post('/repair-prices', async (req, res) => {
  try {
    const apply = req.body && req.body.apply === true;
    const products = await prisma.product.findMany({
      select: { id: true, title: true, currentPrice: true },
    });

    const repaired = [];
    for (const product of products) {
      const rows = await prisma.priceHistory.findMany({
        where: { productId: product.id },
        select: { id: true, price: true },
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length < 4) continue;

      // Each row is judged against the others, so a single outlier cannot
      // defend itself by being in its own reference set.
      const bad = [];
      for (const row of rows) {
        const others = rows.filter(r => r.id !== row.id).map(r => r.price);
        const check = looksLikeUnlabelledPayment(row.price, others);
        if (check.implausible) bad.push({ id: row.id, price: row.price, median: check.reference });
      }
      if (bad.length === 0) continue;

      // Never delete every row: if most readings look implausible, the
      // reference is the broken thing, not the rows.
      if (bad.length > rows.length / 2) continue;

      if (apply) {
        await prisma.priceHistory.deleteMany({ where: { id: { in: bad.map(b => b.id) } } });
        await reconcileAggregates(prisma, product.id);
      }
      repaired.push({
        productId: product.id,
        title: product.title,
        removed: bad.map(b => b.price),
        median: bad[0].median,
      });
    }

    res.json({
      applied: apply,
      productsAffected: repaired.length,
      rowsRemoved: repaired.reduce((n, r) => n + r.removed.length, 0),
      details: repaired,
      message: apply
        ? 'Instalment rows deleted and price aggregates recomputed.'
        : 'Dry run. Nothing was changed. Send { "apply": true } to delete these rows.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
