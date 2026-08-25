const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordResetEmail } = require('../services/mailer');
const { isAdminEmail } = require('../utils/admin');
const authMiddleware = require('../middleware/auth');

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

// POST /api/auth/forgot-password, email a reset link if the account exists.
// NOTE: this deliberately reveals whether an email is registered (404 if not
// found) at the request of the project owner, trading the usual
// anti-enumeration protection for clearer UX during development/demoing.
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

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
      return res.status(502).json({ error: 'Could not send the reset email. Please try again later.' });
    }

    res.json({ message: 'A reset link has been sent to your email.' });
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
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, createdAt: true, wishlistPublic: true, emailAlertsEnabled: true },
    });
    res.json({ ...user, isAdmin: isAdminEmail(user.email) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/profile  (protected), update name/email
router.patch('/profile',
  authMiddleware,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { name, email, wishlistPublic, emailAlertsEnabled } = req.body;

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Only check for a conflicting email if it's actually changing. Toggles
    // like wishlistPublic/emailAlertsEnabled resend the unchanged email on
    // every request, so checking unconditionally caused every save to fail
    // with a false "Email already in use" the moment the email happened to
    // collide with a stale/duplicate lookup instead of a real conflict.
    if (email !== currentUser.email) {
      const existing = await prisma.user.findFirst({ where: { email, NOT: { id: req.userId } } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });

      // Admin rights are derived purely from the address matching
      // ADMIN_EMAILS, and there is no email verification anywhere in this
      // app. So if an address in that list has no account yet — a
      // not-yet-onboarded admin, an alias, a rotated address — any user
      // could simply set their own email to it and become an admin. Claiming
      // an admin address through a self-service profile edit is never
      // legitimate: an admin account is created by registering with that
      // address, not by renaming an existing one into it.
      if (isAdminEmail(email) && !isAdminEmail(currentUser.email)) {
        return res.status(403).json({ error: 'That email address cannot be used.' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        email,
        // Optional: lets a user hide their wishlist from Community browsing
        // and the Follow-by-name search without touching name/email.
        ...(typeof wishlistPublic === 'boolean' ? { wishlistPublic } : {}),
        // Optional: opt out of price-drop emails without affecting in-app notifications.
        ...(typeof emailAlertsEnabled === 'boolean' ? { emailAlertsEnabled } : {}),
      },
      select: { id: true, name: true, email: true, wishlistPublic: true, emailAlertsEnabled: true },
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
    //
    // Also clear any outstanding password-reset token. Without this, a reset
    // link an attacker requested earlier (and deliberately did not use) stays
    // valid for its full hour AFTER the victim changes their password — so
    // the victim does everything right, believes the account is secured, and
    // the attacker still takes it over from the stashed link.
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        password: hashed,
        tokenVersion: { increment: 1 },
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/account  (protected), permanently delete the caller's own
// account. Requires the current password so a hijacked-but-not-fully-trusted
// session (e.g. a stolen JWT) can't wipe an account without knowing it.
// Prisma cascades the delete to the user's wishlist items, notifications,
// etc. the same way the admin delete-user route does.
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required to delete your account' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
