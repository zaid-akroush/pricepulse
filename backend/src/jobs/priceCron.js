const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { fetchCurrentPrice } = require('../services/serpApi');
const { sendPriceDropEmail } = require('../services/mailer');

const prisma = new PrismaClient();

/**
 * For every tracked product, fetch the latest price.
 * If it dropped below a user's target price, send a notification email.
 */
async function checkPrices() {
  console.log(`[cron] Price check started at ${new Date().toISOString()}`);

  const products = await prisma.product.findMany({
    include: {
      wishlistItems: {
        include: { user: true },
      },
    },
  });

  for (const product of products) {
    try {
      const newPrice = await fetchCurrentPrice(product.serpApiQuery, product.title);
      if (newPrice == null) continue;

      // Record price history
      await prisma.priceHistory.create({
        data: { productId: product.id, price: newPrice },
      });

      // Update product stats
      await prisma.product.update({
        where: { id: product.id },
        data: {
          currentPrice: newPrice,
          lowestPrice: Math.min(product.lowestPrice, newPrice),
          highestPrice: Math.max(product.highestPrice, newPrice),
          lastChecked: new Date(),
        },
      });

      // Notify users whose target price has been met
      for (const item of product.wishlistItems) {
        const targetMet = item.targetPrice != null && newPrice <= item.targetPrice;
        const priceDrop = newPrice < product.currentPrice;

        if ((targetMet || priceDrop) && !item.notified) {
          await sendPriceDropEmail(item.user.email, {
            title: product.title,
            currentPrice: newPrice,
            targetPrice: item.targetPrice,
            url: product.url,
            imageUrl: product.imageUrl,
            currency: product.currency,
          });

          // Mark as notified to avoid repeat emails until price changes again
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: { notified: true },
          });
        }

        // Reset notified flag if price went back up
        if (newPrice > product.currentPrice && item.notified) {
          await prisma.wishlistItem.update({
            where: { id: item.id },
            data: { notified: false },
          });
        }
      }
    } catch (err) {
      console.error(`[cron] Error checking product ${product.id}: ${err.message}`);
    }
  }

  console.log(`[cron] Price check completed`);
}

function startPriceCron() {
  // Runs every 6 hours by default
  const schedule = process.env.CRON_SCHEDULE || '0 */6 * * *';
  cron.schedule(schedule, checkPrices);
  console.log(`[cron] Price monitoring scheduled: ${schedule}`);
}

module.exports = { startPriceCron, checkPrices };
