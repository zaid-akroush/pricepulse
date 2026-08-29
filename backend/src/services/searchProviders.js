// Where live shopping results come from.
//
// The app was hard-wired to Serper, whose free allowance is a one-time 2,500
// credits — when it ran out, live search was simply over. This isolates the
// "ask someone for shopping listings" step behind one function so the
// provider is an environment setting rather than a code change, and so a
// provider running out is a config problem instead of a dead feature.
//
// A provider returns RAW items. All the normalising, price parsing and
// filtering stays in services/serpApi, so every provider inherits the same
// site-wide rules.

const axios = require('axios');

const TIMEOUT_MS = 20000;

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
// Bright Data SERP API — 5,000 requests/month on the free tier, recurring.
// Docs: POST https://api.brightdata.com/request with a Google URL; adding
// brd_json=1 makes Bright Data parse the SERP and return JSON instead of HTML.
// ---------------------------------------------------------------------------
const BRIGHTDATA_URL = 'https://api.brightdata.com/request';

// Bright Data's parsed Google Shopping payload has moved between keys over
// time (shopping / product_listing_ads / organic for tbm=shop). Read all of
// them rather than betting the feature on one field name.
const BRIGHTDATA_ITEM_KEYS = ['shopping', 'shopping_results', 'product_listing_ads', 'products', 'organic'];

function brightDataItems(data) {
  if (!data || typeof data !== 'object') return [];
  for (const key of BRIGHTDATA_ITEM_KEYS) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

async function brightDataShopping(query) {
  const token = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_SERP_ZONE;
  if (!token) throw new ProviderError('Product search is not configured (missing API key).', 500, 'brightdata');
  if (!zone) {
    throw new ProviderError(
      'Product search is not configured (BRIGHTDATA_SERP_ZONE is not set — Bright Data requires the name of your SERP zone).',
      500, 'brightdata'
    );
  }

  const target = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=shop&brd_json=1`;
  const { data } = await axios.post(
    BRIGHTDATA_URL,
    { zone, url: target, format: 'raw' },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
    }
  );

  // format:"raw" returns the body as-is, which is a JSON string when
  // brd_json=1 is set — axios may or may not have parsed it already.
  let parsed = data;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  if (!parsed) {
    throw new ProviderError('The search provider returned a response we could not parse as JSON.', 502, 'brightdata');
  }

  return brightDataItems(parsed).map(item => ({
    title: item.title || item.name || null,
    price: item.price ?? item.extracted_price ?? null,
    url: item.link || item.url || item.product_link || null,
    imageUrl: item.image || item.imageUrl || item.thumbnail || item.image_url || null,
    source: item.seller || item.source || item.merchant || item.store || null,
    rating: item.rating ?? null,
    reviews: item.reviews ?? item.reviews_cnt ?? item.ratingCount ?? null,
  }));
}

// ---------------------------------------------------------------------------
// SerpApi — 250 searches/month on the free tier, renewed monthly.
// GET https://serpapi.com/search?engine=google_shopping&q=…&api_key=…
// Items come back under `shopping_results`, already parsed.
// ---------------------------------------------------------------------------
const SERPAPI_URL = 'https://serpapi.com/search';

async function serpApiShopping(query) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new ProviderError('Product search is not configured (missing API key).', 500, 'serpapi');

  const { data } = await axios.get(SERPAPI_URL, {
    params: {
      engine: 'google_shopping',
      q: query,
      gl: process.env.SERPAPI_COUNTRY || 'us',
      hl: process.env.SERPAPI_LANGUAGE || 'en',
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
  }));
}

// ---------------------------------------------------------------------------
// Serper.dev — kept so an existing key keeps working. Free allowance is a
// one-time 2,500 credits, so this is no longer the default.
// ---------------------------------------------------------------------------
const SERPER_URL = 'https://google.serper.dev/shopping';

async function serperShopping(query) {
  const key = process.env.SERP_API_KEY;
  if (!key) throw new ProviderError('Product search is not configured (missing API key).', 500, 'serper');

  const { data } = await axios.post(
    SERPER_URL,
    { q: query },
    { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }
  );

  return (data.shopping || []).map(item => ({
    title: item.title || item.name || null,
    price: item.price ?? null,
    url: item.link || item.url || null,
    imageUrl: item.imageUrl || item.thumbnail || null,
    source: item.source || null,
    rating: item.rating ?? null,
    reviews: item.ratingCount ?? null,
  }));
}

const PROVIDERS = {
  serpapi: { label: 'SerpApi', fetch: serpApiShopping },
  brightdata: { label: 'Bright Data SERP API', fetch: brightDataShopping },
  serper: { label: 'Serper.dev', fetch: serperShopping },
};

/**
 * Which provider is active. SEARCH_PROVIDER wins; otherwise whichever key is
 * present, preferring the providers whose free tier renews monthly over
 * Serper, whose free allowance is a one-time grant.
 */
function activeProviderName() {
  const explicit = (process.env.SEARCH_PROVIDER || '').trim().toLowerCase();
  if (explicit && PROVIDERS[explicit]) return explicit;
  if (process.env.SERPAPI_KEY) return 'serpapi';
  if (process.env.BRIGHTDATA_API_KEY) return 'brightdata';
  if (process.env.SERP_API_KEY) return 'serper';
  return 'serpapi'; // so the "not configured" error names the intended one
}

function activeProvider() {
  const name = activeProviderName();
  return { name, ...PROVIDERS[name] };
}

/** Raw shopping items for a query, from whichever provider is configured. */
async function fetchShopping(query) {
  const provider = activeProvider();
  return { provider: provider.name, items: await provider.fetch(query) };
}

module.exports = { fetchShopping, activeProvider, activeProviderName, ProviderError, PROVIDERS };
