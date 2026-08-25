const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { fetchCurrentPrice, SerpApiError } = require('../services/serpApi');
const { sendPriceDropEmail } = require('../services/mailer');
const { createNotification } = require('../services/notify');
const { recordPrice } = require('../services/productPrice');

const prisma = new PrismaClient();

// Only one sweep may run at a time.
//
// node-cron does not prevent overlap by default, and the admin "Run price
// check now" button calls checkPrices() directly without tracking it. Two
// concurrent sweeps both read `item.notified === false` before either writes
// it, so a user received two identical emails and two duplicate in-app
// notifications, two priceHistory rows for the same moment, and double the
// paid API credits were spent.
let sweepInProgress = false;

/**
 * For every tracked product, fetch the latest price and alert the users
 * tracking it.
 *
 * @returns {Promise<{ran: boolean, checked: number, updated: number, alerts: number, reason?: string}>}
 */
async function checkPrices() {
  if (sweepInProgress) {
    console.log('[cron] Price check already running, skipping this trigger.');
    return { ran: false, checked: 0, updated: 0, alerts: 0, reason: 'already_running' };
  }
  sweepInProgress = true;

  const startedAt = Date.now();
  console.log(`[cron] Price check started at ${new Date().toISOString()}`);

  let checked = 0;
  let updated = 0;
  let alerts = 0;

  try {
    const products = await prisma.product.findMany({
      include: {
        wishlistItems: {
          include: { user: true },
        },
      },
    });

    for (const product of products) {
      try {
        checked++;
        const newPrice = await fetchCurrentPrice(product.serpApiQuery, product.title);
        if (newPrice == null) continue;

        // The price BEFORE this update. Every drop comparison below must use
        // this, not the freshly written value.
        const previousPrice = product.currentPrice;

        // recordPrice writes the history row AND recomputes the bounds from
        // history, so a bad reading can be corrected by deleting its row.
        const bounds = await recordPrice(prisma, product, newPrice);
        if (!bounds) continue;
        product.highestPrice = bounds.highestPrice;
        product.lowestPrice = bounds.lowestPrice;
        updated++;

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
        // A 402/401/403 means the account is out of credits or the key is bad,
        // so every remaining product will fail the same way. Stop burning
        // requests/log noise and pick back up on the next scheduled run.
        if (err instanceof SerpApiError && [401, 402, 403].includes(err.status)) {
          console.error('[cron] Stopping price check early, search provider is unavailable (status ' + err.status + ').');
          break;
        }
      }
    }
  } finally {
    sweepInProgress = false;
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[cron] Price check completed in ${seconds}s — ${checked} checked, ${updated} updated, ${alerts} alerts sent`);
  return { ran: true, checked, updated, alerts };
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

  // The in-app notification is the alert of record: it always fires, and if
  // writing it fails we must NOT mark the item as notified, or the user loses
  // this drop permanently (only a price *increase* ever cleared the flag).
  const notification = await createNotification(prisma, {
    userId: item.userId,
    type: isTarget ? 'target_hit' : 'price_drop',
    message,
    productId: product.id,
  });
  if (!notification) {
    console.error(`[cron] Not marking item ${item.id} as notified: the notification could not be stored.`);
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

  await prisma.wishlistItem.update({
    where: { id: item.id },
    data: isTarget
      ? { notified: true, notifiedTargetAt: new Date() }
      : { notified: true },
  });

  return 1;
}

function startPriceCron() {
  // Runs every 6 hours by default
  const schedule = process.env.CRON_SCHEDULE || '0 */6 * * *';
  // noOverlap is belt-and-braces on top of the sweepInProgress guard above,
  // which also covers the admin-triggered run.
  cron.schedule(schedule, checkPrices, { noOverlap: true });
  console.log(`[cron] Price monitoring scheduled: ${schedule}`);
}

module.exports = { startPriceCron, checkPrices };
