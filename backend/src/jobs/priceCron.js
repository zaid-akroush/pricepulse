const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { searchProducts, pickPriceFor, fetchCurrentPrice, SerpApiError } = require('../services/serpApi');
const { scheduleFor, queryKey } = require('../services/scheduling');
const { sendPriceDropEmail } = require('../services/mailer');
const { createNotification } = require('../services/notify');
const { recordPrice } = require('../services/productPrice');

const prisma = new PrismaClient();

const HOUR_MS = 60 * 60 * 1000;
const RECENT_WINDOW_MS = 14 * 24 * HOUR_MS;
// An observation must come from a search no older than this. The general
// search cache keeps results for 6 hours for browsing; recording a 6-hour-old
// result as a fresh data point would put phantom duplicates in the history.
const OBSERVATION_MAX_AGE_MS = Number(process.env.OBSERVATION_MAX_AGE_MS || HOUR_MS);

// Only one sweep may run at a time.
//
// node-cron does not prevent overlap by default, and the admin "Run price
// check now" button calls checkPrices() directly without tracking it. Two
// concurrent sweeps both read `item.notified === false` before either writes
// it, so a user received two identical emails and two duplicate in-app
// notifications, two priceHistory rows for the same moment, and double the
// paid API credits were spent.
let sweepInProgress = false;

// Products currently being observed by ANY path (the sweep, a manual refresh,
// a view refresh). The sweep guard above only stops two sweeps; a page view
// during a sweep used to observe the same product a second time and send the
// same alert twice. A product in this set is skipped by whoever comes second.
const observing = new Set();

// Reference price for the "not a small fraction of the known price" rule in
// pickPriceFor. The latest reading alone is fragile: one wrong-high reading
// would reject every genuine listing forever. The median of the recent
// observations (falling back to currentPrice) tolerates a single bad point.
function referencePrice(product, history) {
  const pts = (history || []).map(h => Number(h.price)).filter(p => p > 0).slice(-5);
  if (product.currentPrice > 0) pts.push(product.currentPrice);
  if (pts.length === 0) return null;
  pts.sort((a, b) => a - b);
  return pts[Math.floor(pts.length / 2)];
}

/**
 * Re-check every product that is due (nextCheckAt has passed), record the
 * price, alert the users tracking it, and schedule the next check.
 *
 * Products that share a search string and market are served by ONE provider
 * request: the sweep groups them, runs the search once, and matches each
 * product's title against the same result list. With the adaptive interval
 * this is what keeps the request budget proportional to how much the prices
 * actually move rather than to how many products exist.
 *
 * @param {{all?: boolean}} [opts] all=true re-checks every product regardless
 *   of schedule (the admin "Run price check now" button).
 * @returns {Promise<{ran: boolean, checked: number, updated: number, alerts: number, due: number, queries: number, reason?: string}>}
 */
async function checkPrices(opts = {}) {
  if (sweepInProgress) {
    console.log('[cron] Price check already running, skipping this trigger.');
    return { ran: false, checked: 0, updated: 0, alerts: 0, due: 0, queries: 0, reason: 'already_running' };
  }
  sweepInProgress = true;

  const startedAt = Date.now();
  console.log(`[cron] Price check started at ${new Date().toISOString()}${opts.all ? ' (all products)' : ''}`);

  let checked = 0;
  let updated = 0;
  let alerts = 0;
  let queries = 0;
  let due = 0;

  try {
    const products = await prisma.product.findMany({
      where: opts.all ? {} : { nextCheckAt: { lte: new Date() } },
      include: {
        wishlistItems: {
          include: { user: true },
        },
        // Only the recent window is needed for volatility; oldest-first so
        // the scheduler can walk it in order.
        priceHistory: {
          where: { recordedAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
          orderBy: { recordedAt: 'asc' },
          select: { price: true, recordedAt: true },
        },
      },
      orderBy: { nextCheckAt: 'asc' },
    });
    due = products.length;

    // One provider request per distinct (market, query) pair.
    const groups = new Map();
    for (const product of products) {
      const key = queryKey(product.serpApiQuery, product.country);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    }

    outer:
    for (const group of groups.values()) {
      let results;
      try {
        queries++;
        // techOnly:false: these products are already tracked (see searchProducts).
        results = await searchProducts(group[0].serpApiQuery, { techOnly: false, country: group[0].country, maxAgeMs: OBSERVATION_MAX_AGE_MS });
      } catch (err) {
        console.error(`[cron] Search failed for "${group[0].serpApiQuery}" (${group[0].country}): ${err.message}`);
        // A 402/401/403 means the account is out of credits or the key is bad,
        // so every remaining query will fail the same way. Stop burning
        // requests and pick back up on the next scheduled run; nothing is
        // rescheduled, so the same products are due again next hour.
        if (err instanceof SerpApiError && [401, 402, 403].includes(err.status)) {
          console.error('[cron] Stopping price check early, search provider is unavailable (status ' + err.status + ').');
          break;
        }
        continue;
      }

      for (const product of group) {
      if (observing.has(product.id)) continue; // a refresh is already on it
      observing.add(product.id);
      try {
        checked++;
        const newPrice = pickPriceFor(results, product.title, referencePrice(product, product.priceHistory));
        if (newPrice == null) {
          // No listing matched this run. Reschedule anyway, otherwise a
          // product whose listing vanished would be retried every hour, and
          // stamp lastChecked so a later reschedule (tracker added/removed)
          // measures from this attempt rather than from the last success.
          await prisma.product.update({ where: { id: product.id }, data: { lastChecked: new Date() } });
          await reschedule(product, product.priceHistory);
          continue;
        }

        // The price BEFORE this update. Every drop comparison below must use
        // this, not the freshly written value.
        const previousPrice = product.currentPrice;

        // recordPrice writes the history row AND recomputes the bounds from
        // history, so a bad reading can be corrected by deleting its row.
        const bounds = await recordPrice(prisma, product, newPrice);
        if (!bounds) continue;
        product.highestPrice = bounds.highestPrice;
        product.lowestPrice = bounds.lowestPrice;
        product.currentPrice = newPrice;
        updated++;

        await reschedule(product, [...product.priceHistory, { price: newPrice, recordedAt: new Date() }]);

        for (const item of product.wishlistItems) {
          // One bad wishlist item (deleted mid-run, a user row that vanished)
          // used to abort the whole product loop, so everyone else tracking
          // this product silently got no alert — and because the product's
          // price had already been written, the drop was never reported at
          // all on any later run. Each item is now isolated.
          try {
            alerts += await notifyItem({ product, item, newPrice, previousPrice });
          } catch (err) {
            console.error(`[cron] Error notifying wishlist item ${item.id}: ${err.message}`);
          }
        }
      } catch (err) {
        console.error(`[cron] Error checking product ${product.id}: ${err.message}`);
        if (err instanceof SerpApiError && [401, 402, 403].includes(err.status)) {
          console.error('[cron] Stopping price check early, search provider is unavailable (status ' + err.status + ').');
          observing.delete(product.id);
          break outer;
        }
      } finally {
        observing.delete(product.id);
      }
      }
    }
  } finally {
    sweepInProgress = false;
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[cron] Price check completed in ${seconds}s, ${due} due, ${queries} queries, ${checked} checked, ${updated} updated, ${alerts} alerts sent`);
  return { ran: true, checked, updated, alerts, due, queries };
}

/**
 * Store the adaptive interval and the next due time for a product.
 */
async function reschedule(product, history) {
  const { hours, nextCheckAt } = scheduleFor({ product, items: product.wishlistItems, history });
  await prisma.product.update({
    where: { id: product.id },
    data: { checkIntervalHours: hours, nextCheckAt },
  });
}

/**
 * Decide whether one wishlist item deserves an alert, and send it.
 * @returns {Promise<number>} how many alerts were sent (0 or 1)
 */
async function notifyItem({ product, item, newPrice, previousPrice }) {
  const targetMet = item.targetPrice != null && newPrice <= item.targetPrice;

  const dropPct = previousPrice > 0
    ? ((previousPrice - newPrice) / previousPrice) * 100
    : 0;
  const significantDrop = dropPct >= 3;

  const dropFromPeakPct = product.highestPrice > 0
    ? ((product.highestPrice - newPrice) / product.highestPrice) * 100
    : 0;
  const customDropMet = item.targetDropPercent != null && dropFromPeakPct >= item.targetDropPercent;

  // A single `notified` flag used to suppress every kind of alert once any
  // one of them had fired. So a generic "dropped 3%" alert at $480 blocked
  // the "hit your target" alert at $390 — the app silently missed the exact
  // event it exists to report. Target hits are now tracked separately, so a
  // generic drop can never swallow one.
  const targetAlreadySent = item.notifiedTargetAt != null;
  const shouldSendTarget = targetMet && !targetAlreadySent;
  const shouldSendDrop = (significantDrop || customDropMet) && !item.notified && !targetMet;

  if (!shouldSendTarget && !shouldSendDrop) {
    // Price recovered: re-arm both alerts so the next real drop is reported.
    if (newPrice > previousPrice && (item.notified || targetAlreadySent)) {
      await prisma.wishlistItem.update({
        where: { id: item.id },
        data: { notified: false, notifiedTargetAt: null },
      });
    }
    return 0;
  }

  const isTarget = shouldSendTarget;
  const message = isTarget
    ? `${product.title} hit your target, now ${product.currency} ${newPrice.toFixed(2)}`
    : `${product.title} dropped to ${product.currency} ${newPrice.toFixed(2)}`;

  // Claim the alert first with a conditional update, so two observers that
  // both read notified=false (sweep plus a page view) cannot both send it.
  // Whoever loses the race sees count 0 and sends nothing. The flag is
  // rolled back below if the notification cannot be stored.
  const claim = await prisma.wishlistItem.updateMany({
    where: isTarget ? { id: item.id, notifiedTargetAt: null } : { id: item.id, notified: false },
    data: isTarget ? { notified: true, notifiedTargetAt: new Date() } : { notified: true },
  });
  if (claim.count === 0) return 0;

  // The in-app notification is the alert of record. If writing it fails the
  // claim is released again, or the user would lose this drop permanently
  // (only a price *increase* ever clears the flags).
  const notification = await createNotification(prisma, {
    userId: item.userId,
    type: isTarget ? 'target_hit' : 'price_drop',
    message,
    productId: product.id,
  });
  if (!notification) {
    console.error(`[cron] Releasing alert claim on item ${item.id}: the notification could not be stored.`);
    await prisma.wishlistItem.update({
      where: { id: item.id },
      data: isTarget ? { notifiedTargetAt: null } : { notified: false },
    }).catch(() => {});
    return 0;
  }

  if (item.user.emailAlertsEnabled) {
    // The email is best-effort on top of the in-app notification. A failure
    // is logged but does not block the flag, because the user has already
    // been told in the app.
    await sendPriceDropEmail(item.user.email, {
      title: product.title,
      currentPrice: newPrice,
      targetPrice: item.targetPrice,
      url: product.url,
      imageUrl: product.imageUrl,
      currency: product.currency,
    }).catch(err => console.error(`[cron] Failed to send price-drop email to user ${item.userId}: ${err.message}`));
  }

  return 1;
}

function startPriceCron() {
  // The tick is hourly by default; which products are actually re-checked on
  // a given tick is decided per product by nextCheckAt (services/scheduling).
  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
  // noOverlap is belt-and-braces on top of the sweepInProgress guard above,
  // which also covers the admin-triggered run.
  cron.schedule(schedule, () => checkPrices().catch(err => console.error('[cron] sweep failed:', err.message)), { noOverlap: true });
  console.log(`[cron] Price monitoring scheduled: ${schedule}`);
}

/**
 * Load a product with everything the sweep logic needs for one item.
 */
function loadForObservation(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      wishlistItems: { include: { user: true } },
      priceHistory: {
        where: { recordedAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
        orderBy: { recordedAt: 'asc' },
        select: { price: true, recordedAt: true },
      },
    },
  });
}

/**
 * Fetch a fresh price for ONE product and treat it exactly like the sweep
 * would: record it, evaluate every tracker's alert, and reschedule.
 *
 * Used by the manual "Check price now" button and the background refresh on
 * product views. Before this existed those paths recorded the price but
 * never ran the alert logic, so a drop first seen there was silently
 * consumed: the next sweep compared against the already-updated
 * currentPrice and saw no change.
 *
 * @param {number} productId
 * @param {{maxAgeMs?: number}} [opts]
 * @returns {Promise<{price: number|null, alerts: number}>}
 */
async function observePrice(productId, opts = {}) {
  if (observing.has(productId)) return { price: null, alerts: 0, reason: 'already_observing' };
  observing.add(productId);
  try {
    return await observeLocked(productId, opts);
  } finally {
    observing.delete(productId);
  }
}

async function observeLocked(productId, opts) {
  const product = await loadForObservation(productId);
  if (!product) return { price: null, alerts: 0 };

  const newPrice = await fetchCurrentPrice(product.serpApiQuery, product.title, {
    country: product.country,
    maxAgeMs: opts.maxAgeMs ?? OBSERVATION_MAX_AGE_MS,
    knownPrice: referencePrice(product, product.priceHistory),
  });
  if (newPrice == null) {
    await prisma.product.update({ where: { id: product.id }, data: { lastChecked: new Date() } });
    await reschedule(product, product.priceHistory);
    return { price: null, alerts: 0 };
  }

  const previousPrice = product.currentPrice;
  const bounds = await recordPrice(prisma, product, newPrice);
  if (!bounds) return { price: null, alerts: 0 };
  product.highestPrice = bounds.highestPrice;
  product.lowestPrice = bounds.lowestPrice;
  product.currentPrice = newPrice;

  let alerts = 0;
  for (const item of product.wishlistItems) {
    try {
      alerts += await notifyItem({ product, item, newPrice, previousPrice });
    } catch (err) {
      console.error(`[observe] Error notifying wishlist item ${item.id}: ${err.message}`);
    }
  }
  await reschedule(product, [...product.priceHistory, { price: newPrice, recordedAt: new Date() }]);
  return { price: newPrice, alerts };
}

/**
 * Re-plan one product from its current trackers and history. Called when a
 * tracker is added or removed (the interval depends on how many people are
 * waiting).
 */
async function rescheduleProduct(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      wishlistItems: { select: { targetPrice: true, targetDropPercent: true } },
      priceHistory: {
        where: { recordedAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
        orderBy: { recordedAt: 'asc' },
        select: { price: true, recordedAt: true },
      },
    },
  });
  if (!product) return null;
  // Never push an already-due product further out: keep whichever is sooner.
  const { hours, nextCheckAt } = scheduleFor({ product, items: product.wishlistItems, history: product.priceHistory, now: new Date(product.lastChecked).getTime() });
  const next = nextCheckAt < product.nextCheckAt ? nextCheckAt : product.nextCheckAt;
  await prisma.product.update({ where: { id: productId }, data: { checkIntervalHours: hours, nextCheckAt: next } });
  return { hours, nextCheckAt: next };
}

module.exports = { startPriceCron, checkPrices, reschedule, rescheduleProduct, observePrice };
