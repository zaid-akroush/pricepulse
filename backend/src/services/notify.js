// Central notification helper: writes an in-app Notification row and fires a
// web-push message (if the user has subscribed). Used by the price cron and
// any other place that needs to alert a user.
const { sendToUser } = require('./push');

async function createNotification(prisma, { userId, type, message, productId = null }) {
  let notification = null;
  try {
    notification = await prisma.notification.create({
      data: { userId, type, message, productId },
    });
  } catch (err) {
    console.error('[notify] failed to create notification:', err.message);
  }

  // Fire push in the background, never block the caller on it.
  sendToUser(prisma, userId, {
    title: titleFor(type),
    body: message,
    productId,
    url: productId ? `/product/${productId}` : '/notifications',
  }).catch(() => {});

  return notification;
}

function titleFor(type) {
  switch (type) {
    case 'price_drop': return '📉 Price dropped';
    case 'target_hit': return '🎯 Target price hit';
    case 'new_follower': return '👤 New follower';
    case 'deal_alert': return '⚡ Deal alert';
    default: return 'PricePulse';
  }
}

module.exports = { createNotification };
