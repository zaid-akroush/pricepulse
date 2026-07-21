const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordResetEmail } = require('../services/mailer');
const { isAdminEmail } = require('../utils/admin');

const router = express.Router();
const prisma = new PrismaClient();

// Pick the public frontend URL for building reset links. CLIENT_URL is a
// comma-separated list; prefer the first https origin (the deployed site),
// falling back to the first entry or localhost.
function getFrontendUrl() {
  const origins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean);
  return origins.find(o => o.startsWith('https://')) || origins[0] || 'http://localhost:3000';
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// POST /api/auth/register
router.post('/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: isAdminEmail(user.email) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { email, password } = req.body;

    // Collapse "no account" and "wrong password" into one generic response so
    // a login attempt can't be used to enumerate which emails are registered
    // (same approach already used by /forgot-password below).
    const genericError = { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json(genericError);

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json(genericError);

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: isAdminEmail(user.email) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password, email a reset link if the account exists
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  // Always respond the same way so we never reveal whether an email is registered.
  const genericMsg = { message: 'If an account exists for that email, a reset link has been sent.' };

  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashToken(rawToken), resetTokenExpiry: expiry },
      });

      const resetUrl = `${getFrontendUrl()}/reset-password?token=${rawToken}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        console.error('[forgot-password] email send failed:', mailErr.message);
      }
    }

    res.json(genericMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password, set a new password using a valid token
router.post('/reset-password',
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashToken(token),
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      // Bump tokenVersion so any previously-issued JWT (e.g. a leaked 7-day
      // token) is rejected by authMiddleware after a reset.
      data: { password: hashed, resetToken: null, resetTokenExpiry: null, tokenVersion: { increment: 1 } },
    });

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  (protected)
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    res.json({ ...user, isAdmin: isAdminEmail(user.email) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/profile  (protected), update name/email
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: req.userId } } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { name, email },
      select: { id: true, name: true, email: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/password  (protected), change password
router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
    if (newPassword.length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    // Bump tokenVersion so a leaked long-lived JWT stops working the moment
    // the password changes, instead of staying valid until it expires.
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed, tokenVersion: { increment: 1 } } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
