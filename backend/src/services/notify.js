// Writes an in-app Notification row. Used by the price cron.
async function createNotification(prisma, { userId, type, message, productId = null }) {
  try {
    return await prisma.notification.create({ data: { userId, type, message, productId } });
  } catch (err) {
    console.error('[notify] failed to create notification:', err.message);
    return null;
  }
}

module.exports = { createNotification };
