// Web-push helper. Fully optional: if VAPID keys are not configured the
// module degrades gracefully and every call becomes a no-op, so the rest of
// the app keeps working without push set up.
let webpush = null;
let enabled = false;

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@pricepulse.app';

try {
  if (PUBLIC_KEY && PRIVATE_KEY) {
    webpush = require('web-push');
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    enabled = true;
    console.log('[push] Web push enabled');
  } else {
    console.log('[push] VAPID keys not set, push notifications disabled');
  }
} catch (err) {
  console.warn('[push] web-push not available:', err.message);
}

function isEnabled() {
  return enabled;
}

function getPublicKey() {
  return enabled ? PUBLIC_KEY : null;
}

/**
 * Send a push message to every subscription belonging to a user.
 * Dead subscriptions (404/410) are pruned automatically.
 */
async function sendToUser(prisma, userId, payload) {
  if (!enabled) return;
  let subs = [];
  try {
    subs = await prisma.pushSubscription.findMany({ where: { userId } });
  } catch (_) {
    return; // table may not exist yet (migration not run)
  }
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error('[push] send error:', err.message);
        }
      }
    })
  );
}

module.exports = { isEnabled, getPublicKey, sendToUser };
