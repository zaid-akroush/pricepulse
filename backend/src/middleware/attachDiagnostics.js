const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { isAdminEmail } = require('../utils/admin');

const prisma = new PrismaClient();

// Marks the request as coming from an admin (req.isAdmin) without blocking
// anyone. The global error handler uses this to decide whether a failure
// response may carry the full diagnosis — cause, raw message and fix steps —
// or just the short user-facing message.
//
// It deliberately does NOT check tokenVersion, so a token revoked by a
// password change or reset still sets this flag until its cache entry
// expires. That is acceptable for deciding how much detail an error carries,
// and NOT acceptable as an authorisation decision: never gate a route or a
// write on req.isAdmin. Routes needing admin rights use `authMiddleware` +
// `adminOnly`, which re-check tokenVersion against the database.
//
// Result is cached per user id for a short while so a burst of failing
// requests doesn't add a database lookup to each one.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { at, isAdmin }

module.exports = async function attachDiagnostics(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const userId = decoded.userId;

    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      req.isAdmin = hit.isAdmin;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const isAdmin = Boolean(user && isAdminEmail(user.email));
    cache.set(userId, { at: Date.now(), isAdmin });
    req.isAdmin = isAdmin;
  } catch {
    /* not signed in, or a bad token — just not an admin */
  }
  next();
};
