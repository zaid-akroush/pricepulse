// Admin-only guard. Must run AFTER authMiddleware (which sets req.userId).
// Looks up the user's email and checks it against the ADMIN_EMAILS list.
const { PrismaClient } = require('@prisma/client');
const { isAdminEmail } = require('../utils/admin');

const prisma = new PrismaClient();

module.exports = async function adminOnly(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });
    if (!user || !isAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.userEmail = user.email;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
