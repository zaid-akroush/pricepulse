const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { diagnose, environmentReport } = require('./services/diagnostics');
const attachDiagnostics = require('./middleware/attachDiagnostics');
const { version: APP_VERSION } = require('../package.json');
const authMiddleware = require('./middleware/auth');
const adminOnly = require('./middleware/admin');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const wishlistRoutes = require('./routes/wishlist');
const communityRoutes = require('./routes/community');
const socialRoutes = require('./routes/social');
const adminRoutes = require('./routes/admin');
const currencyRoutes = require('./routes/currency');

const app = express();

// Trust the first proxy hop (Render, nginx, etc.) so req.ip reflects the real
// client address instead of the proxy's. Without this, express-rate-limit
// keys every request off the same internal IP in production, meaning all
// users would share one rate-limit bucket.
app.set('trust proxy', 1);

// Security headers. Cross-origin resource policy is relaxed from helmet's
// 'same-origin' default because the frontend (Cloudflare Pages) and this API
// (e.g. a Cloudflare Tunnel URL) are genuinely different origins now, the
// default would silently block the browser from reading API responses even
// with CORS configured correctly below.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS, CLIENT_URL accepts a comma-separated list so both local dev
// (http://localhost:3000) and a deployed frontend (e.g. a *.pages.dev URL)
// can be allowed at the same time.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
console.log('[cors] allowed origins:', allowedOrigins);
app.use(cors({
  origin(origin, callback) {
    // Allow no-origin requests (curl, server-to-server health checks, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
}));

// Body parser
app.use(express.json({ limit: '10kb' }));

// Key rate limits off the REAL visitor. All traffic reaches this backend
// through a single Cloudflare tunnel/Pages Function proxy, so req.ip is the
// same for everyone and would put every visitor in one shared bucket.
// Cloudflare forwards the true client IP in the 'cf-connecting-ip' header,
// so we prefer that — but ONLY when the request also carries a shared
// secret that only our own Cloudflare Pages Function knows (see
// frontend/functions/api/[[path]].js). The backend is also reachable
// directly at its public onrender.com URL, bypassing Cloudflare entirely,
// so trusting 'cf-connecting-ip' unconditionally would let anyone spoof
// that header and get a fresh rate-limit bucket on every request. Without
// the shared secret we fall back to req.ip, which for a direct hit is the
// real connecting IP as seen by the host (not attacker-controlled).
const INTERNAL_PROXY_SECRET = process.env.INTERNAL_PROXY_SECRET;
const clientKey = (req) => {
  const proxySecret = req.headers['x-internal-proxy-secret'];
  if (INTERNAL_PROXY_SECRET && proxySecret === INTERNAL_PROXY_SECRET) {
    return req.headers['cf-connecting-ip'] || req.ip;
  }
  return req.ip;
};

// Rate limiting, 300 requests per 15 minutes per visitor
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit on auth routes, 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: clientKey,
  message: { error: 'Too many login attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/password', authLimiter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
// Flags admin requests so failures below can be answered with a full
// diagnosis. Never blocks a request.
app.use('/api/', attachDiagnostics);


// What is actually deployed. Read from package.json rather than a duplicated
// constant, so `npm version` is the single place a release is stamped. The
// commit and build time are only present when the deploy pipeline provides
// them (Render and most CI systems expose the commit SHA as an env var), and
// are reported as null rather than guessed when it doesn't.
function buildInfo() {
  const commit = process.env.RENDER_GIT_COMMIT
    || process.env.GIT_COMMIT
    || process.env.SOURCE_VERSION
    || process.env.VERCEL_GIT_COMMIT_SHA
    || null;
  return {
    version: APP_VERSION,
    commit: commit ? String(commit).slice(0, 7) : null,
    builtAt: process.env.BUILD_TIME || null,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  };
}

// GET /api/health/diagnostics — admin-only environment self-check. Reports
// which integrations are configured (never their values) and how to fix each
// gap, so an admin can tell at a glance why something isn't loading.
// NOTE: guarded by the real `authMiddleware` + `adminOnly` pair, NOT by
// req.isAdmin. req.isAdmin comes from attachDiagnostics, which skips the
// tokenVersion check — fine for deciding how much an error explains, but it
// would let a token revoked by a password reset keep reading this.
app.get('/api/health/diagnostics', authMiddleware, adminOnly, (req, res) => {
  const checks = environmentReport();
  res.json({
    ok: checks.every(c => c.ok),
    checks,
    ...buildInfo(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/currency', currencyRoutes);

// Global error handler
// Global error handler.
//
// Regular users get the short message only. Admins additionally get a
// `diagnostic` block naming the likely cause and the steps that fix it, so
// "something didn't load" is actionable from the UI instead of requiring a
// trip to the server logs. See services/diagnostics.
// Errors a route raised deliberately (4xx) carry a message written FOR the
// user and are safe to pass through. A 5xx is an internal failure, and its
// message is whatever the library threw — Prisma in particular embeds the
// database host, port and column names. Those were being returned verbatim
// to anonymous callers, so any request made while the DB was down disclosed
// internal infrastructure. 5xx now gets a fixed generic message; the real
// text still goes to the server log, and to the admin-only diagnostic block.
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const safeMessage = status < 500
    ? (err.message || 'Request failed')
    : 'Something went wrong on our side. Please try again.';
  const body = { error: safeMessage };
  if (req.isAdmin) {
    body.diagnostic = diagnose(err, { method: req.method, path: req.originalUrl });
  }
  res.status(status).json(body);
});

module.exports = app;
