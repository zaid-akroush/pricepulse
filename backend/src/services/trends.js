// Market trends computed from the price history the app already collects.
//
// Every observation the scheduler records is public data about a product,
// not about a user, so an aggregate view of it can be shown to visitors
// without an account. This module turns raw history rows into the sections
// of the Trends page. Pure functions on plain arrays, so they are unit-tested
// without a database.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Price at the start and end of a window, taken from a product's history
 * (oldest first). The "start" price is the last observation at or before the
 * window opens, or the first one inside it when the product is newer than
 * the window.
 */
function windowEndpoints(history, windowStartMs) {
  if (!history || history.length < 2) return null;
  let start = null;
  for (const h of history) {
    const t = new Date(h.recordedAt).getTime();
    if (t <= windowStartMs) start = h;
    else { if (!start) start = h; break; }
  }
  const end = history[history.length - 1];
  if (!start || start === end) return null;
  return { start: start.price, end: end.price };
}

/** Largest relative move between consecutive points inside the window (%). */
function volatilityPct(history, windowStartMs) {
  const pts = history.filter(h => new Date(h.recordedAt).getTime() >= windowStartMs);
  let max = 0;
  for (let i = 1; i < pts.length; i++) {
    const rel = Math.abs(pts[i].price - pts[i - 1].price) / pts[i - 1].price * 100;
    if (rel > max) max = rel;
  }
  return max;
}

/** Downsample a history to at most `n` evenly spaced points for a sparkline. */
function sparkline(history, n = 24) {
  const pts = history.map(h => Number(h.price));
  if (pts.length <= n) return pts;
  const out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.round(i * (pts.length - 1) / (n - 1))]);
  return out;
}

/**
 * @param {Array<{id:number,title:string,imageUrl?:string,currency:string,currentPrice:number,
 *   lowestPrice:number,highestPrice:number,priceHistory:{price:number,recordedAt:Date|string}[],
 *   wishlistCount?:number}>} products history oldest-first
 * @param {number} days window length
 * @param {number} [now]
 */
function computeTrends(products, days, now = Date.now()) {
  const windowStart = now - days * DAY_MS;
  const rows = [];
  for (const p of products) {
    const hist = (p.priceHistory || []).filter(h => h.price > 0);
    const ep = windowEndpoints(hist, windowStart);
    if (!ep) continue;
    const changePct = (ep.end - ep.start) / ep.start * 100;
    rows.push({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl || null,
      currency: p.currency,
      currentPrice: p.currentPrice,
      lowestPrice: p.lowestPrice,
      highestPrice: p.highestPrice,
      startPrice: ep.start,
      changePct: Math.round(changePct * 10) / 10,
      changeAmount: Math.round((ep.end - ep.start) * 100) / 100,
      volatilityPct: Math.round(volatilityPct(hist, windowStart) * 10) / 10,
      observations: hist.filter(h => new Date(h.recordedAt).getTime() >= windowStart).length,
      atLow: p.lowestPrice > 0 && p.currentPrice <= p.lowestPrice * 1.005,
      trackers: p.wishlistCount || 0,
      sparkline: sparkline(hist.filter(h => new Date(h.recordedAt).getTime() >= windowStart)),
    });
  }
  const byDrop = rows.filter(r => r.changePct < 0).sort((a, b) => a.changePct - b.changePct);
  const byRise = rows.filter(r => r.changePct > 0).sort((a, b) => b.changePct - a.changePct);
  const byVolatility = rows.filter(r => r.volatilityPct > 0).sort((a, b) => b.volatilityPct - a.volatilityPct);
  const atLow = rows.filter(r => r.atLow).sort((a, b) => b.trackers - a.trackers || a.changePct - b.changePct);

  const observed = rows.length;
  const fell = byDrop.length;
  const rose = byRise.length;
  const avgChange = observed ? rows.reduce((s, r) => s + r.changePct, 0) / observed : 0;

  return {
    days,
    summary: {
      productsObserved: observed,
      fell,
      rose,
      flat: observed - fell - rose,
      averageChangePct: Math.round(avgChange * 10) / 10,
      observations: rows.reduce((s, r) => s + r.observations, 0),
    },
    biggestDrops: byDrop.slice(0, 12),
    biggestRises: byRise.slice(0, 6),
    mostVolatile: byVolatility.slice(0, 6),
    atAllTimeLow: atLow.slice(0, 12),
  };
}

module.exports = { computeTrends, windowEndpoints, volatilityPct, sparkline };
