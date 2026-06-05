const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a price drop notification email.
 * @param {string} to - recipient email
 * @param {object} product - { title, currentPrice, targetPrice, url, imageUrl, currency }
 */
async function sendPriceDropEmail(to, product) {
  const { title, currentPrice, targetPrice, url, imageUrl, currency } = product;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Price Drop Alert! 🎉</h2>
      <p>Good news! A product on your wishlist has dropped to your target price.</p>
      ${imageUrl ? `<img src="${imageUrl}" alt="${title}" style="max-width:200px; border-radius:8px;" />` : ''}
      <h3>${title}</h3>
      <p>
        <strong>Current Price:</strong> ${currency} ${currentPrice.toFixed(2)}<br/>
        ${targetPrice ? `<strong>Your Target Price:</strong> ${currency} ${targetPrice.toFixed(2)}<br/>` : ''}
      </p>
      ${url ? `<a href="${url}" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px;">View Product</a>` : ''}
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        You received this email because you added this item to your PricePulse wishlist.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'PricePulse <onboarding@resend.dev>',
    to,
    subject: `Price Drop: ${title}`,
    html,
  });
}

module.exports = { sendPriceDropEmail };
