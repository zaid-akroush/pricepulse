const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();
const { getPublicKey } = require('../services/push');

// Wrap async handlers so a rejected promise is forwarded to the global error
// handler instead of becoming an unhandled rejection (which crashes the Node
// process under Node's default unhandledRejection behaviour). Many routes below
// take numeric params, so a malformed request (e.g. /is-following/abc → NaN)
// would otherwise throw inside Prisma with no try/catch to contain it.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Parse a route param as a positive integer, or send 400 and return null.
function intParam(res, raw, label = 'id') {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    res.status(400).json({ error: `Invalid ${label}` });
    return null;
  }
  return n;
}

// ── Follow / Unfollow ─────────────────────────────────────────────────────────

// POST /api/social/follow/:userId
router.post('/follow/:userId', auth, asyncHandler(async (req, res) => {
  const followingId = intParam(res, req.params.userId, 'user id');
  if (followingId === null) return;
  const followerId = req.userId;
  if (followerId === followingId) return res.status(400).json({ error: "Can't follow yourself" });
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  const follow = existing || await prisma.follow.create({ data: { followerId, followingId } });
  // Only notify the followed user the first time this relationship is created,
  // not on every repeat/retry of the follow request.
  if (!existing) {
    await prisma.notification.create({
      data: {
        userId: followingId,
        type: 'new_follower',
        message: `Someone started following you`,
      },
    });
  }
  res.json(follow);
}));

// DELETE /api/social/follow/:userId
router.delete('/follow/:userId', auth, asyncHandler(async (req, res) => {
  const followingId = intParam(res, req.params.userId, 'user id');
  if (followingId === null) return;
  const followerId = req.userId;
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  res.json({ success: true });
}));

// GET /api/social/following, who I follow
router.get('/following', auth, asyncHandler(async (req, res) => {
  const follows = await prisma.follow.findMany({
    where: { followerId: req.userId },
    // Never expose another user's email through this path: user IDs are
    // sequential, so a client could loop follow calls and harvest every
    // registered email address via this endpoint otherwise.
    include: { following: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(follows.map(f => f.following));
}));

// GET /api/social/followers, who follows me
router.get('/followers', auth, asyncHandler(async (req, res) => {
  const follows = await prisma.follow.findMany({
    where: { followingId: req.userId },
    // See note in /following above, no email in the projection.
    include: { follower: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(follows.map(f => f.follower));
}));

// GET /api/social/is-following/:userId
router.get('/is-following/:userId', auth, asyncHandler(async (req, res) => {
  const followingId = intParam(res, req.params.userId, 'user id');
  if (followingId === null) return;
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.userId, followingId } },
  });
  res.json({ following: !!follow });
}));

// ── Product Likes ─────────────────────────────────────────────────────────────

// POST /api/social/like/:productId
router.post('/like/:productId', auth, asyncHandler(async (req, res) => {
  const productId = intParam(res, req.params.productId, 'product id');
  if (productId === null) return;
  await prisma.productLike.upsert({
    where: { userId_productId: { userId: req.userId, productId } },
    update: {},
    create: { userId: req.userId, productId },
  });
  const count = await prisma.productLike.count({ where: { productId } });
  res.json({ liked: true, count });
}));

// DELETE /api/social/like/:productId
router.delete('/like/:productId', auth, asyncHandler(async (req, res) => {
  const productId = intParam(res, req.params.productId, 'product id');
  if (productId === null) return;
  await prisma.productLike.deleteMany({ where: { userId: req.userId, productId } });
  const count = await prisma.productLike.count({ where: { productId } });
  res.json({ liked: false, count });
}));

// GET /api/social/likes/:productId
router.get('/likes/:productId', asyncHandler(async (req, res) => {
  const productId = intParam(res, req.params.productId, 'product id');
  if (productId === null) return;
  const count = await prisma.productLike.count({ where: { productId } });
  let liked = false;
  // try to get auth without failing
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      // Same tokenVersion check as authMiddleware, otherwise a token left
      // stale by a password reset would still work against this one route.
      const tokenUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { tokenVersion: true },
      });
      if (tokenUser && (decoded.tokenVersion ?? 0) === tokenUser.tokenVersion) {
        const existing = await prisma.productLike.findUnique({
          where: { userId_productId: { userId: decoded.userId, productId } },
        });
        liked = !!existing;
      }
    } catch (_) {}
  }
  res.json({ count, liked });
}));

// ── Comments ──────────────────────────────────────────────────────────────────

// GET /api/social/comments/:productId
router.get('/comments/:productId', asyncHandler(async (req, res) => {
  const productId = intParam(res, req.params.productId, 'product id');
  if (productId === null) return;
  const comments = await prisma.comment.findMany({
    where: { productId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(comments);
}));

// POST /api/social/comments/:productId
router.post('/comments/:productId', auth, asyncHandler(async (req, res) => {
  const productId = intParam(res, req.params.productId, 'product id');
  if (productId === null) return;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });
  if (text.trim().length > 500) return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });
  const comment = await prisma.comment.create({
    data: { userId: req.userId, productId, text: text.trim() },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json(comment);
}));

// DELETE /api/social/comments/:commentId
router.delete('/comments/:commentId', auth, asyncHandler(async (req, res) => {
  const commentId = intParam(res, req.params.commentId, 'comment id');
  if (commentId === null) return;
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  await prisma.comment.delete({ where: { id: commentId } });
  res.json({ success: true });
}));

// ── Saved Searches ────────────────────────────────────────────────────────────

// GET /api/social/saved-searches
router.get('/saved-searches', auth, asyncHandler(async (req, res) => {
  const searches = await prisma.savedSearch.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(searches);
}));

// POST /api/social/saved-searches
router.post('/saved-searches', auth, asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Query required' });
  if (query.trim().length > 200) return res.status(400).json({ error: 'Query must be 200 characters or fewer' });
  const search = await prisma.savedSearch.upsert({
    where: { userId_query: { userId: req.userId, query: query.trim() } },
    update: { createdAt: new Date() },
    create: { userId: req.userId, query: query.trim() },
  });
  res.json(search);
}));

// DELETE /api/social/saved-searches/:id
router.delete('/saved-searches/:id', auth, asyncHandler(async (req, res) => {
  const id = intParam(res, req.params.id);
  if (id === null) return;
  await prisma.savedSearch.deleteMany({ where: { id, userId: req.userId } });
  res.json({ success: true });
}));

// ── Notifications ─────────────────────────────────────────────────────────────

// GET /api/social/notifications
router.get('/notifications', auth, asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    include: { product: { select: { id: true, title: true, imageUrl: true, currentPrice: true, currency: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}));

// PATCH /api/social/notifications/read-all
router.patch('/notifications/read-all', auth, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ success: true });
}));

// PATCH /api/social/notifications/:id/read
router.patch('/notifications/:id/read', auth, asyncHandler(async (req, res) => {
  const id = intParam(res, req.params.id);
  if (id === null) return;
  await prisma.notification.updateMany({ where: { id, userId: req.userId }, data: { read: true } });
  res.json({ success: true });
}));

// GET /api/social/notifications/unread-count
router.get('/notifications/unread-count', auth, asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.userId, read: false } });
  res.json({ count });
}));

// ── Share Wishlist ─────────────────────────────────────────────────────────────

// POST /api/social/share-wishlist, generate or return share token
router.post('/share-wishlist', auth, asyncHandler(async (req, res) => {
  let user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.shareToken) {
    const { randomBytes } = require('crypto');
    const token = randomBytes(12).toString('hex');
    user = await prisma.user.update({
      where: { id: req.userId },
      data: { shareToken: token },
    });
  }
  res.json({ token: user.shareToken });
}));

// GET /api/social/share-wishlist, returns the current share token (if any)
// without generating one, so the frontend can render the toggle state.
router.get('/share-wishlist', auth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { shareToken: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ token: user.shareToken || null });
}));

// DELETE /api/social/share-wishlist, revokes the current share link (existing
// links stop working immediately; a new POST generates a fresh token).
router.delete('/share-wishlist', auth, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { shareToken: null } });
  res.json({ token: null });
}));

// GET /api/social/shared-wishlist/:token, public, no auth. Only exposes the
// owner's display name and their wishlist items — no email, password hash,
// or other account fields.
router.get('/shared-wishlist/:token', asyncHandler(async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{24}$/.test(token)) return res.status(404).json({ error: 'Wishlist not found' });
  const user = await prisma.user.findUnique({
    where: { shareToken: token },
    select: {
      id: true, name: true, createdAt: true,
      wishlistItems: {
        include: {
          product: { include: { priceHistory: { orderBy: { recordedAt: 'asc' } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!user) return res.status(404).json({ error: 'Wishlist not found' });
  res.json({ name: user.name, memberSince: user.createdAt, items: user.wishlistItems });
}));


// -- Web Push -----------------------------------------------------------------

// GET /api/social/push/vapid-public-key  (public)
router.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

// POST /api/social/push/subscribe, store a browser push subscription
router.post('/push/subscribe', auth, asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'Invalid subscription' });
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ id: sub.id });
}));

// DELETE /api/social/push/unsubscribe, remove a subscription by endpoint
router.delete('/push/unsubscribe', auth, asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  }
  res.json({ ok: true });
}));

module.exports = router;
