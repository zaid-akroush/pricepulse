// Shopping markets: which Google Shopping country a search runs in, and the
// currency listings from that market are priced in.
//
// Prices were always fetched from the US market and stored as USD, with the
// display currency converted client-side. That gave a student in Debrecen a
// dollar price from Best Buy that they cannot actually buy at. A market is
// now a first-class search parameter: the provider is asked for that
// country's listings (SerpApi/Serper `gl`, Bright Data `gl`), the product
// remembers the market it was found in, and the scheduler re-queries in the
// same market so the price history stays comparable.
//
// The currency codes here MUST be a subset of SUPPORTED in services/currency.js
// (and the frontend's SUPPORTED_CURRENCIES), otherwise conversion silently
// falls back to 1:1.

const MARKETS = [
  { code: 'us', name: 'United States', currency: 'USD', language: 'en' },
  { code: 'gb', name: 'United Kingdom', currency: 'GBP', language: 'en' },
  { code: 'de', name: 'Germany', currency: 'EUR', language: 'de' },
  { code: 'fr', name: 'France', currency: 'EUR', language: 'fr' },
  { code: 'it', name: 'Italy', currency: 'EUR', language: 'it' },
  { code: 'es', name: 'Spain', currency: 'EUR', language: 'es' },
  { code: 'nl', name: 'Netherlands', currency: 'EUR', language: 'nl' },
  { code: 'at', name: 'Austria', currency: 'EUR', language: 'de' },
  { code: 'hu', name: 'Hungary', currency: 'HUF', language: 'hu' },
  { code: 'ch', name: 'Switzerland', currency: 'CHF', language: 'de' },
  { code: 'ca', name: 'Canada', currency: 'CAD', language: 'en' },
  { code: 'au', name: 'Australia', currency: 'AUD', language: 'en' },
  { code: 'in', name: 'India', currency: 'INR', language: 'en' },
  { code: 'jp', name: 'Japan', currency: 'JPY', language: 'ja' },
  { code: 'jo', name: 'Jordan', currency: 'JOD', language: 'en' },
];

const BY_CODE = new Map(MARKETS.map(m => [m.code, m]));
// SERPAPI_COUNTRY used to be the only way to pick a market; it now sets the
// default one for searches that do not specify a market.
const envDefault = String(process.env.SERPAPI_COUNTRY || '').trim().toLowerCase();
const DEFAULT_MARKET = BY_CODE.has(envDefault) ? envDefault : 'us';

/**
 * Normalise a user-supplied market code. Unknown or missing values fall back
 * to the default market rather than throwing, so a stale value saved in a
 * browser can never break search.
 */
function resolveMarket(code) {
  const key = String(code || '').trim().toLowerCase();
  return BY_CODE.get(key) || BY_CODE.get(DEFAULT_MARKET);
}

function isValidMarket(code) {
  return BY_CODE.has(String(code || '').trim().toLowerCase());
}

module.exports = { MARKETS, DEFAULT_MARKET, resolveMarket, isValidMarket };
