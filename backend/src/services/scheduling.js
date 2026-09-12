// Adaptive price-check scheduling.
//
// Every product used to be re-queried every six hours regardless of how it
// behaved, and every product cost one paid provider request per sweep. That
// spends the same quota on a product nobody tracks whose price has not moved
// in a month as on a product ten people are watching that dropped yesterday.
//
// The sweep now runs hourly and only re-checks products whose nextCheckAt has
// passed. After every observation the interval is recomputed from three
// signals: how many people track the product, how volatile its recent price
// has been, and whether a tracker's target is close enough that a small move
// would matter. Pure function, no I/O, so it is unit-tested directly.

const HOUR_MS = 60 * 60 * 1000;

const MIN_HOURS = clampInt(process.env.SCHEDULE_MIN_HOURS, 3, 1, 48);
const MAX_HOURS = clampInt(process.env.SCHEDULE_MAX_HOURS, 48, MIN_HOURS, 24 * 14);

// How far back recent movement is measured.
const VOLATILITY_WINDOW_DAYS = 14;
// A tracker whose target is within this fraction of the current price is
// "near": the price only has to move a little for the alert the user is
// waiting for, so check more often.
const NEAR_TARGET_RATIO = 0.10;

function clampInt(raw, fallback, lo, hi) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Largest relative move between consecutive observations inside the window,
 * as a percentage. Returns 0 with fewer than two points.
 *
 * @param {{price:number, recordedAt:Date|string}[]} history any order
 * @param {number} [now]
 */
function recentVolatilityPct(history, now = Date.now()) {
  const cutoff = now - VOLATILITY_WINDOW_DAYS * 24 * HOUR_MS;
  const pts = (history || [])
    .map(h => ({ price: Number(h.price), t: new Date(h.recordedAt).getTime() }))
    .filter(h => Number.isFinite(h.price) && h.price > 0 && h.t >= cutoff)
    .sort((a, b) => a.t - b.t);
  let max = 0;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1].price;
    const rel = Math.abs(pts[i].price - prev) / prev * 100;
    if (rel > max) max = rel;
  }
  return max;
}

/**
 * Is any tracker close to being satisfied?
 * @param {{targetPrice?:number|null, targetDropPercent?:number|null}[]} items
 */
function hasNearTarget(items, currentPrice, highestPrice) {
  if (!(currentPrice > 0)) return false;
  for (const it of items || []) {
    if (it.targetPrice != null && it.targetPrice > 0) {
      // Already met counts as near: the next move decides whether it re-arms.
      if (currentPrice <= it.targetPrice * (1 + NEAR_TARGET_RATIO)) return true;
    }
    if (it.targetDropPercent != null && highestPrice > 0) {
      const dropSoFar = (highestPrice - currentPrice) / highestPrice * 100;
      if (dropSoFar >= it.targetDropPercent - 5) return true;
    }
  }
  return false;
}

/**
 * Decide how many hours to wait before the next check.
 *
 * @param {object} p
 * @param {number} p.trackerCount   wishlist items pointing at the product
 * @param {number} p.volatilityPct  from recentVolatilityPct()
 * @param {boolean} p.nearTarget    from hasNearTarget()
 * @returns {number} whole hours, within [MIN_HOURS, MAX_HOURS]
 */
function computeCheckIntervalHours({ trackerCount = 0, volatilityPct = 0, nearTarget = false }) {
  let hours;
  if (trackerCount <= 0) hours = MAX_HOURS;      // nobody is waiting on it
  else if (trackerCount >= 3) hours = 6;
  else hours = 12;

  if (volatilityPct >= 3) hours = Math.min(hours, 6);
  if (volatilityPct >= 8) hours = Math.min(hours, MIN_HOURS);
  if (nearTarget && trackerCount > 0) hours = Math.min(hours, MIN_HOURS);

  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(hours)));
}

/**
 * Convenience: everything the sweep needs in one call.
 */
function scheduleFor({ product, items, history, now = Date.now() }) {
  const volatilityPct = recentVolatilityPct(history, now);
  const nearTarget = hasNearTarget(items, product.currentPrice, product.highestPrice);
  const hours = computeCheckIntervalHours({ trackerCount: (items || []).length, volatilityPct, nearTarget });
  return { hours, nextCheckAt: new Date(now + hours * HOUR_MS), volatilityPct, nearTarget };
}

/**
 * Group products that share a search so one provider request serves all of
 * them. Key is the normalised query plus the market it runs in.
 */
function queryKey(query, country) {
  return `${String(country || 'us').toLowerCase()}|${String(query || '').trim().toLowerCase()}`;
}

module.exports = {
  MIN_HOURS, MAX_HOURS, NEAR_TARGET_RATIO, VOLATILITY_WINDOW_DAYS,
  recentVolatilityPct, hasNearTarget, computeCheckIntervalHours, scheduleFor, queryKey,
};
