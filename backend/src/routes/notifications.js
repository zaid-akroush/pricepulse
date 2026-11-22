const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const prisma = new PrismaClient();
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

// GET /api/notifications
router.get('/', auth, asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    include: { product: { select: { id: true, title: true, imageUrl: true, currentPrice: true, currency: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}));

// PATCH /api/notifications/read-all
router.patch('/read-all', auth, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ success: true });
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', auth, asyncHandler(async (req, res) => {
  const id = intParam(res, req.params.id);
  if (id === null) return;
  await prisma.notification.updateMany({ where: { id, userId: req.userId }, data: { read: true } });
  res.json({ success: true });
}));

// GET /api/notifications/unread-count
router.get('/unread-count', auth, asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.userId, read: false } });
  res.json({ count });
}));

module.exports = router;
