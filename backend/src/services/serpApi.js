const axios = require('axios');

const SERP_API_KEY = process.env.SERP_API_KEY;
const SERPER_SHOPPING_URL = 'https://google.serper.dev/shopping';

/**
 * Thrown for problems talking to the search provider (bad/expired key, out
 * of credits, rate limited, etc). Carries an HTTP-ish status so callers can
 * decide how to respond without parsing message strings.
 */
class SerpApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SerpApiError';
    this.status = status;
  }
}

/**
 * Search Google Shopping for products matching query.
 * Returns an array of normalized product objects.
 */
const { isTechProduct, getReleaseStatus } = require('./productClassifier');
const { parsePrice, isRecurringPrice } = require('./priceParse');

/**
 * @param {string} query
 * @param {object} [opts]
 * @param {boolean} [opts.techOnly=true] Apply the electronics-only filter.
 *   MUST be false for callers that re-query an ALREADY TRACKED product
 *   (price refresh, compare, image gallery). The filter is a discovery rule:
 *   applying it there would make a product whose title the classifier does
 *   not recognise stop updating its price forever, silently, with no log —
 *   and vanish from its own comparison and gallery.
 */
async function searchProducts(query, opts = {}) {
  const { techOnly = true } = opts;
  if (!SERP_API_KEY) throw new SerpApiError('Product search is not configured (missing API key).', 500);

  let data;
  try {
    ({ data } = await axios.post(
      SERPER_SHOPPING_URL,
      { q: query },
      {
        headers: {
          'X-API-KEY': SERP_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    ));
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 401) {
      // Serper returns 401/403 for a bad key, and 403 also when the
      // account is out of credits, not something a retry will fix.
      throw new SerpApiError('Product search is temporarily unavailable (search provider rejected the request, check the API key or credit balance).', status);
    }
    if (status === 429) {
      throw new SerpApiError('Product search is rate limited right now. Please try again shortly.', 429);
    }
    if (status === 402) {
      throw new SerpApiError('Product search is temporarily unavailable (search provider is out of credits). Please try again later.', 402);
    }
    // Serper reports an exhausted plan as 400 "Not enough credits", not the
    // 402 the code originally assumed. Match on the message too, so an
    // out-of-credits account is diagnosed as such whatever status carries it.
    const rawMsg = err.response?.data?.message || err.response?.data?.error || '';
    if (/not enough credits|insufficient credits|out of credits|quota exceeded/i.test(rawMsg)) {
      throw new SerpApiError(
        'Product search is unavailable: the search provider account is out of credits. Cached prices are still shown.',
        402
      );
    }

    // Anything else: name what actually happened rather than the old blanket
    // "try again later", which was indistinguishable from a rejected key.
    const providerMsg =
      err.response?.data?.message || err.response?.data?.error || err.code || err.message;
    const cause = status
      ? `search provider returned HTTP ${status}${providerMsg ? `: ${providerMsg}` : ''}`
      : `could not reach the search provider${providerMsg ? `: ${providerMsg}` : ''}`;
    throw new SerpApiError(`Product search failed (${cause}).`, status || 502);
  }

  const results = data.shopping || [];

  // Two site-wide rules, applied at this single choke point so every feature
  // that reads shopping data (search, compare, image gallery, price refresh)
  // inherits them automatically:
  //   1. Only consumer electronics. The shopping API answers whatever query
  //      it's given, so a search for "china" or "apple" returned dinnerware
  //      and fruit juice. See services/productClassifier.
  //   2. Products that aren't out yet are kept but flagged, so the UI can say
  //      so rather than presenting a pre-order as a buyable price.

  // Minimum plausible price by keyword, catches monthly-plan prices
  const PRICE_FLOORS = [
    { pattern: /iphone|samsung galaxy|pixel \d|oneplus/i,   min: 200 },
    { pattern: /macbook|xps|thinkpad|surface laptop/i,       min: 400 },
    { pattern: /ipad|galaxy tab|surface pro/i,               min: 150 },
    { pattern: /playstation|xbox|nintendo switch/i,          min: 150 },
    { pattern: /graphics card|rtx|rx \d{4}/i,               min: 150 },
    { pattern: /laptop|notebook/i,                           min: 150 },
    { pattern: /tv|television|\d{2,3}"/i,                   min: 100 },
  ];

  // Serper shopping items look like:
  // { title, source, link, price: "$1,099.99", delivery, imageUrl, rating, ratingCount, position, productId }
  const normalized = results.map((item) => {
    // See services/priceParse. The previous inline parse stripped everything
    // except digits and dots, which turned "US$ 1 099,99" into 109999 and
    // "€1.299,00" into 1.299 — silently, with no way to tell afterwards.
    const price = parsePrice(item.price);
    const recurring = isRecurringPrice(item.price);
    const title = item.title || item.name;
    const release = getReleaseStatus(title);
    return {
      title,
      price,
      currency: 'USD',
      originalPrice: null, // Serper's shopping endpoint doesn't return a pre-discount price
      url: item.link || item.url || null,
      imageUrl: item.imageUrl || item.thumbnail || null,
      source: item.source || null,
      serpApiQuery: query,
      rating: item.rating || null,
      reviews: item.ratingCount || null,
      released: release.released,
      releaseLabel: release.label,
      releaseReason: release.reason,
      // A per-month instalment figure is not this product's price.
      recurring,
    };
  });

  return normalized.filter(item => {
    if (!item.price || item.price <= 0) return false;
    // Instalment/subscription pricing: "$10.42/mo" for a $599 phone.
    if (item.recurring) return false;
    // Discovery only — see the techOnly note on this function.
    if (techOnly && !isTechProduct(item.title)) return false;
    for (const { pattern, min } of PRICE_FLOORS) {
      if (pattern.test(item.title) && item.price < min) return false;
    }
    // Generic floor: drop anything under $3 (almost certainly a monthly plan)
    if (item.price < 3) return false;
    return true;
  });
}


// Do two listing titles describe the same product?
//
// Mirrors the matcher used by the compare endpoint: every token containing a
// digit must appear in both (capacity, model number, generation), and the
// brands must not conflict. Deliberately strict — this decides what gets
// written into a product's price history.
const MATCH_STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'new', 'best', 'deal', 'unlocked', 'factory',
  'refurbished', 'renewed', 'open', 'box', 'smartphone', 'phone', 'device',
]);

function matchTokens(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 2 && !MATCH_STOPWORDS.has(t));
}

function sameProduct(trackedTitle, candidateTitle) {
  const a = matchTokens(trackedTitle);
  const b = new Set(matchTokens(candidateTitle));
  if (a.length === 0 || b.size === 0) return false;

  // Every model-identifying token must be present in the candidate.
  for (const token of a) {
    if (/\d/.test(token) && !b.has(token)) return false;
  }

  // And enough of the rest, so an unrelated listing that happens to share the
  // model numbers still doesn't match.
  const overlap = a.filter(t => b.has(t)).length;
  return overlap / a.length >= 0.5;
}

/**
 * Fetch the current price of a single tracked product by re-running its query
 * and finding the closest title match.
 */
async function fetchCurrentPrice(serpApiQuery, productTitle) {
  // techOnly:false — this product is already tracked; re-checking its price
  // must never depend on the discovery classifier recognising its title.
  const results = await searchProducts(serpApiQuery, { techOnly: false });

  // Matching used to be `title.includes(trackedTitle.slice(0, 20))` and took
  // the first hit. For "Samsung Galaxy S24 Ultra 512GB - Titanium Black" that
  // key is "samsung galaxy s24 u", which happily matches the 256GB model —
  // so the cheaper variant's price was written into this product's history
  // and became its permanent lowestPrice.
  //
  // sameProduct requires every model-identifying token (anything containing a
  // digit: "512gb", "s24") to be present, so a different capacity or
  // generation can no longer match. If nothing matches we return null and the
  // caller records no price, which is the correct outcome: no data is better
  // than the wrong product's data.
  const scored = results
    .filter(r => r.title && sameProduct(productTitle, r.title))
    .sort((a, b) => a.price - b.price);

  return scored.length > 0 ? scored[0].price : null;
}

module.exports = { searchProducts, fetchCurrentPrice, SerpApiError };
