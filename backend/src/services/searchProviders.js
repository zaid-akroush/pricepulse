// Fetches raw Google Shopping listings from SerpApi.
//
// Returns RAW items; all normalising, price parsing and filtering stays in
// services/serpApi.js.

const axios = require('axios');

const TIMEOUT_MS = 20000;

// How many listings to ask the provider for. The default page is small, and
// our own rules (tech-only, price floors, carrier offers, instalment prices)
// discard a large share of what comes back — asking for one page then
// filtering it left a handful of cards on screen. One request returns up to
// 100 whatever this is set to, so a bigger page costs no extra quota.
const RESULTS_PER_SEARCH = Math.min(Number(process.env.RESULTS_PER_SEARCH || 60), 100);

/** Thrown for provider-level problems (bad key, no credits, rate limit). */
class ProviderError extends Error {
  constructor(message, status, provider) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.provider = provider;
  }
}

// ---------------------------------------------------------------------------
// GET https://serpapi.com/search?engine=google_shopping&q=…&api_key=…
// Items come back under `shopping_results`, already parsed.
// ---------------------------------------------------------------------------
const SERPAPI_URL = 'https://serpapi.com/search';

async function serpApiShopping(query, market) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new ProviderError('Product search is not configured (missing API key).', 500, 'serpapi');

  const { data } = await axios.get(SERPAPI_URL, {
    params: {
      engine: 'google_shopping',
      q: query,
      num: RESULTS_PER_SEARCH,
      // The market is a per-search choice now; the env vars only set the
      // default market (see services/markets.js).
      gl: market.code,
      hl: market.language,
      api_key: key,
    },
    timeout: TIMEOUT_MS,
  });

  // SerpApi answers 200 with an `error` field for a bad key or an exhausted
  // plan, so a failure here never reaches the axios catch. Surface it as the
  // provider error it is instead of returning zero results, which would look
  // like "nothing matched your search".
  if (data?.error) {
    const text = String(data.error);
    const outOfQuota = /run out|exhausted|limit|plan|credits/i.test(text);
    throw new ProviderError(
      outOfQuota
        ? `Product search is unavailable: the SerpApi account has no searches left this month (${text}). Cached prices are still shown.`
        : `Product search failed (SerpApi: ${text}).`,
      outOfQuota ? 402 : 502,
      'serpapi'
    );
  }

  return (data.shopping_results || []).map(item => ({
    title: item.title || null,
    // `price` is the formatted string ("$1,099.99"); parsePrice in serpApi
    // handles it, and extracted_price is the fallback when it is absent.
    price: item.price ?? item.extracted_price ?? null,
    url: item.product_link || item.link || null,
    imageUrl: item.thumbnail || null,
    source: item.source || null,
    rating: item.rating ?? null,
    reviews: item.reviews ?? null,
    // Financing terms ("or $33.25/mo. for 12 mo.", "Lease from ...") live in
    // these side fields, never in `price`. services/paymentTerms reads them.
    extras: [item.extensions, item.snippet, item.delivery, item.second_hand_condition]
      .flat()
      .filter(Boolean)
      .map(String),
  }));
}

/**
 * Raw shopping items for a query.
 * @param {string} query
 * @param {{code:string, language:string, currency:string}} market resolved by services/markets
 */
async function fetchShopping(query, market) {
  return { provider: 'serpapi', items: await serpApiShopping(query, market) };
}

module.exports = { fetchShopping, ProviderError };
