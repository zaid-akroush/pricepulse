const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// title/imageUrl/url ultimately originate from unauthenticated/user-supplied
// input (products.js POST /from-search, wishlist.js POST /), so they must be
// escaped before being interpolated into HTML we send as email.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a price drop notification email.
 * @param {string} to - recipient email
 * @param {object} product - { title, currentPrice, targetPrice, url, imageUrl, currency }
 */
async function sendPriceDropEmail(to, product) {
  const { currentPrice, targetPrice, currency } = product;
  const title = escapeHtml(product.title);
  const imageUrl = escapeHtml(product.imageUrl);
  const url = escapeHtml(product.url);

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

  const { error } = await resend.emails.send({
    from: 'PricePulse <onboarding@resend.dev>',
    to,
    subject: `Price Drop: ${title}`,
    html,
  });
  // The Resend SDK resolves with { data, error } instead of rejecting on
  // API-level failures (e.g. sandbox mode restricting recipients), so a
  // failed send would otherwise be silently swallowed by callers' try/catch.
  if (error) throw new Error(error.message || 'Failed to send email');
}

/**
 * Send a password-reset email with a time-limited link.
 * @param {string} to - recipient email
 * @param {string} resetUrl - full URL the user clicks to reset their password
 */
async function sendPasswordResetEmail(to, resetUrl) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ea580c;">Reset your password</h2>
      <p>We received a request to reset the password for your PricePulse account.</p>
      <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:16px 0;">Reset Password</a>
      <p style="color:#6b7280;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="color:#6b7280;font-size:13px;word-break:break-all;">${resetUrl}</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        If you didn't request a password reset, you can safely ignore this email. Your password won't change.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: 'PricePulse <onboarding@resend.dev>',
    to,
    subject: 'Reset your PricePulse password',
    html,
  });
  if (error) throw new Error(error.message || 'Failed to send email');
}

module.exports = { sendPriceDropEmail, sendPasswordResetEmail };
