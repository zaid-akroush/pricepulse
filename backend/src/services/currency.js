const axios = require('axios');

// Frankfurter (frankfurter.app) is a free, keyless exchange-rate API backed
// by daily ECB reference rates — no API key to configure/leak, unlike most
// currency APIs. Rates are cached in memory since they only change once a
// day, so there's no reason to hit the upstream API on every request.
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// The set of currencies PricePulse actually offers as a display option in
// the UI (kept in sync with frontend/src/context/CurrencyContext.jsx).
const SUPPORTED = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'CHF', 'JOD', 'HUF'];

// JOD (Jordanian Dinar) has been pegged by Jordan's central bank at a fixed
// 1 JOD = 1.41044 USD since 1995 — it floats against nothing, so Frankfurter
// (an ECB reference-rate feed) doesn't carry it at all. Rather than leave it
// silently broken, the peg is hardcoded here and merged in below.
const JOD_PER_USD = 1 / 1.41044;

let cache = { base: null, rates: null, fetchedAt: 0 };

async function getRates(base = 'USD') {
  // JOD can't be a base for the upstream call (Frankfurter doesn't know it
  // at all, peg or not), fall back to USD if ever requested as one.
  const normalizedBase = SUPPORTED.includes(base) && base !== 'JOD' ? base : 'USD';
  const fresh = cache.base === normalizedBase && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
  if (fresh) return cache;

  try {
    const { data } = await axios.get(FRANKFURTER_URL, {
      params: { from: normalizedBase, to: SUPPORTED.filter(c => c !== normalizedBase && c !== 'JOD').join(',') },
      timeout: 8000,
    });
    // JOD/USD is a fixed peg, not a floating rate, so it's derived directly
    // from the base currency's own USD rate rather than fetched.
    const usdPerBase = normalizedBase === 'USD' ? 1 : 1 / data.rates.USD;
    cache = {
      base: normalizedBase,
      // The base currency itself always converts 1:1, Frankfurter's response
      // only includes the *other* currencies.
      rates: { [normalizedBase]: 1, ...data.rates, JOD: JOD_PER_USD * usdPerBase },
      fetchedAt: Date.now(),
    };
    return cache;
  } catch (err) {
    // If the upstream API is down but we have a (possibly stale) cache for
    // this base currency, serve that rather than failing the request, a
    // slightly-stale conversion is far better than no currency conversion.
    if (cache.base === normalizedBase && cache.rates) return cache;
    throw err;
  }
}

module.exports = { getRates, SUPPORTED };
