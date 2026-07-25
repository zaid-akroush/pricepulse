const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// The open "browse everyone's public wishlist" / leaderboard endpoints that
// used to live here were removed along with the standalone Community page.
// Only the scoped, opt-in follow-by-name endpoints below remain — you can
// look someone up and follow them, but there's no way to passively browse
// or rank every user's wishlist anymore.

// GET /api/community/find?name=<query>  (auth required)
// Looks up users by (partial, case-insensitive) name so you can follow
// someone by typing who they are, rather than browsing an open feed of
// everyone's wishlist. Only surfaces users who've kept wishlistPublic on,
// and never returns email or other account fields.
router.get('/find', auth, asyncHandler(async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.json([]);
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long' });
  const users = await prisma.user.findMany({
    where: {
      name: { contains: name, mode: 'insensitive' },
      wishlistPublic: true,
      NOT: { id: req.userId },
    },
    select: {
      id: true,
      name: true,
      _count: { select: { wishlistItems: true } },
    },
    take: 10,
  });
  res.json(users.map(u => ({ userId: u.id, name: u.name, itemCount: u._count.wishlistItems })));
}));

// GET /api/community/following-wishlists  (auth required)
// Same shape as /wishlists, but scoped to only the people the current user
// follows — this is what backs the Wishlist page's "Following" tab, so
// following someone by name actually surfaces their tracked products
// afterward instead of just recording a relationship.
router.get('/following-wishlists', auth, asyncHandler(async (req, res) => {
  const follows = await prisma.follow.findMany({
    where: { followerId: req.userId },
    select: { followingId: true },
  });
  const followingIds = follows.map(f => f.followingId);
  if (followingIds.length === 0) return res.json([]);

  const users = await prisma.user.findMany({
    where: { id: { in: followingIds }, wishlistPublic: true },
    select: {
      id: true,
      name: true,
      createdAt: true,
      wishlistItems: {
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  res.json(users.map(u => ({
    userId: u.id,
    name: u.name,
    memberSince: u.createdAt,
    itemCount: u.wishlistItems.length,
    totalValue: u.wishlistItems.reduce((sum, i) => sum + i.product.currentPrice, 0),
    items: u.wishlistItems,
  })));
}));

module.exports = router;
