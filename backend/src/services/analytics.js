// Pure helpers for the wishlist analytics endpoint.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert an amount into US dollars using a rate table relative to USD (the
 * shape services/currency returns for base=USD). Unknown currency: returned
 * unchanged, which matches the client's own fallback behaviour.
 */
function toUsd(amount, currency, rates) {
  if (!(amount > 0)) return 0;
  if (!currency || currency === 'USD' || !rates) return amount;
  const r = rates[currency];
  return r > 0 ? amount / r : amount;
}

/**
 * Daily series of what the user's tracked products are worth and how much
 * cheaper they are than their peak, over the last `days` days.
 *
 * For each day, a product's price is its last observation at or before the
 * end of that day and its peak is the highest observation up to then, so
 * the "saved" figure never uses knowledge of the future. Products with no
 * observation yet on a given day are simply not counted that day, which is
 * why `tracked` is reported alongside the totals.
 *
 * @param {Array<{currency:string, priceHistory:{price:number, recordedAt:Date|string}[]}>} items
 * @param {number} days
 * @param {object|null} rates USD-based rate table, or null for no conversion
 * @param {number} [now]
 * @returns {{date:string, value:number, saved:number, tracked:number}[]}
 */
function savingsTimeline(items, days = 90, rates = null, now = Date.now()) {
  const series = items.map(it => ({
    currency: it.currency,
    pts: (it.priceHistory || [])
      .map(h => ({ t: new Date(h.recordedAt).getTime(), price: Number(h.price) }))
      .filter(h => Number.isFinite(h.price) && h.price > 0)
      .sort((a, b) => a.t - b.t),
  }));

  const out = [];
  const end = new Date(now); end.setUTCHours(23, 59, 59, 999);
  for (let d = days - 1; d >= 0; d--) {
    const dayEnd = end.getTime() - d * DAY_MS;
    let value = 0, saved = 0, tracked = 0;
    for (const s of series) {
      let price = null, peak = 0;
      for (const h of s.pts) {
        if (h.t > dayEnd) break;
        price = h.price;
        if (h.price > peak) peak = h.price;
      }
      if (price == null) continue;
      tracked++;
      value += toUsd(price, s.currency, rates);
      saved += toUsd(Math.max(0, peak - price), s.currency, rates);
    }
    out.push({
      date: new Date(dayEnd).toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100,
      saved: Math.round(saved * 100) / 100,
      tracked,
    });
  }
  return out;
}

module.exports = { toUsd, savingsTimeline };
