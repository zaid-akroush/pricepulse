const { fetchShopping, activeProvider, ProviderError } = require('./searchProviders');

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

// Search results are cached in memory and shared by every caller — the search
// page, compare, the image gallery and the price cron all funnel through
// searchProducts. Every live call spends a request from a metered plan, and
// the same query arrives repeatedly (category chips, back-navigation, a user
// retrying). Without this the free monthly allowance was being spent on
// answers we already had. Prices do not move minute to minute, so a
// medium-length TTL costs nothing in accuracy.
const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map(); // query -> { at, items }

// Once the provider says the plan is exhausted or the key is bad, every
// further call fails the same way and still counts as an attempt. Stop
// calling out for a while and fail fast from here instead.
const BREAKER_MS = 10 * 60 * 1000;
let breakerUntil = 0;
let breakerError = null;

function cacheKey(query) {
  return String(query || '').trim().toLowerCase();
}

function cachePut(key, items) {
  searchCache.delete(key);
  searchCache.set(key, { at: Date.now(), items });
  while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
}

function cacheTake(key) {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= SEARCH_CACHE_TTL_MS) { searchCache.delete(key); return null; }
  return hit.items;
}

/** Test/ops hook — drops every cached query and re-arms the breaker. */
function resetSearchCache() {
  searchCache.clear();
  breakerUntil = 0;
  breakerError = null;
}

// Map a provider failure onto the SerpApiError the rest of the app expects,
// naming the real cause. Serper reports an exhausted plan as HTTP 400
// "Not enough credits", others as 402, so the message is matched too.
function toSerpApiError(err, providerLabel) {
  if (err instanceof ProviderError) return new SerpApiError(err.message, err.status);

  const status = err.response?.status;
  const rawMsg = err.response?.data?.message || err.response?.data?.error || '';
  const text = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);

  if (/not enough credits|insufficient credits|out of credits|quota exceeded|limit reached/i.test(text)) {
    return new SerpApiError(
      `Product search is unavailable: the ${providerLabel} account is out of credits for this period. Cached prices are still shown.`,
      402
    );
  }
  if (status === 401 || status === 403) {
    return new SerpApiError(
      `Product search is unavailable: ${providerLabel} rejected our API key (HTTP ${status}). Check the key and the account's balance.`,
      status
    );
  }
  if (status === 402) {
    return new SerpApiError(`Product search is unavailable: the ${providerLabel} account is out of credits.`, 402);
  }
  if (status === 429) {
    return new SerpApiError(`Product search is rate limited by ${providerLabel} right now. Please try again shortly.`, 429);
  }

  const detail = text || err.code || err.message;
  const cause = status
    ? `${providerLabel} returned HTTP ${status}${detail ? `: ${detail}` : ''}`
    : `could not reach ${providerLabel}${detail ? `: ${detail}` : ''}`;
  return new SerpApiError(`Product search failed (${cause}).`, status || 502);
}

/**
 * Search Google Shopping for products matching query.
 * Returns an array of normalized product objects.
 */
const { isTechProduct, getReleaseStatus } = require('./productClassifier');
const { parsePrice, isRecurringPrice } = require('./priceParse');
const { extractAttributes } = require('./productAttributes');

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
  const key = cacheKey(query);
  const cached = cacheTake(key);
  const provider = activeProvider();

  let results;
  if (cached) {
    results = cached;
  } else {
    if (Date.now() < breakerUntil && breakerError) {
      // Short-circuit while the provider is known to be refusing us.
      throw new SerpApiError(breakerError.message, breakerError.status);
    }
    try {
      const { items } = await fetchShopping(query);
      results = items;
      cachePut(key, items);
      breakerUntil = 0;
      breakerError = null;
    } catch (err) {
      const mapped = toSerpApiError(err, provider.label);
      if ([401, 402, 403, 429].includes(mapped.status)) {
        breakerUntil = Date.now() + BREAKER_MS;
        breakerError = mapped;
      }
      throw mapped;
    }
  }


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
    // Budget handsets: the floor has to be low enough to admit a genuine
    // cheap phone, but above the $20-$40 activation prices carriers list.
    { pattern: /moto g|moto e|galaxy a\d|redmi|poco|nokia [gc]\d/i, min: 60 },
    { pattern: /macbook|xps|thinkpad|surface laptop/i,       min: 400 },
    { pattern: /ipad|galaxy tab|surface pro/i,               min: 150 },
    { pattern: /playstation|xbox|nintendo switch/i,          min: 150 },
    { pattern: /graphics card|rtx|rx \d{4}/i,               min: 150 },
    { pattern: /laptop|notebook/i,                           min: 150 },
    { pattern: /tv|television|\d{2,3}"/i,                   min: 100 },
  ];

  // Providers hand back a common raw shape (see services/searchProviders):
  // { title, price: "$1,099.99", url, imageUrl, source, rating, reviews }
  const normalized = results.map((item) => {
    // See services/priceParse. The previous inline parse stripped everything
    // except digits and dots, which turned "US$ 1 099,99" into 109999 and
    // "€1.299,00" into 1.299 — silently, with no way to tell afterwards.
    const price = parsePrice(item.price);
    const recurring = isRecurringPrice(item.price);
    const title = item.title;
    const release = getReleaseStatus(title);
    return {
      title,
      price,
      currency: 'USD',
      originalPrice: null, // no provider returns a reliable pre-discount price
      url: item.url || null,
      imageUrl: item.imageUrl || null,
      source: item.source || null,
      serpApiQuery: query,
      rating: item.rating || null,
      reviews: item.reviews || null,
      released: release.released,
      releaseLabel: release.label,
      releaseReason: release.reason,
      // A per-month instalment figure is not this product's price.
      recurring,
      // Facets for the search sidebar (condition, storage, colour, brand…).
      // Derived here so every consumer of shopping data sees the same values.
      ...extractAttributes(title, item.source || null),
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


// How many of a country's brands are queried for one country search. Each
// brand is a separate provider request, and the free plan is metered, so this
// is deliberately small — the per-query cache means a repeated country search
// costs nothing.
const COUNTRY_BRAND_LIMIT = Number(process.env.COUNTRY_BRAND_LIMIT || 3);
// Per brand, so one brand cannot fill the whole page.
const COUNTRY_PER_BRAND = 8;

/**
 * Products from a country's tech brands.
 *
 * Searching each brand separately (rather than one "Chinese electronics"
 * query) is what makes the results real products instead of articles and
 * listicles, and it lets us verify each listing actually belongs to the brand
 * we asked for.
 *
 * @param {string[]} brands
 * @returns {Promise<{results: object[], brandsSearched: string[], failed: string[]}>}
 */
async function searchByBrands(brands) {
  const chosen = brands.slice(0, COUNTRY_BRAND_LIMIT);

  const settled = await Promise.allSettled(chosen.map(b => searchProducts(b)));

  const failed = [];
  const perBrand = [];
  settled.forEach((outcome, i) => {
    const brand = chosen[i];
    if (outcome.status === 'rejected') {
      failed.push(brand);
      return;
    }
    // The provider answers the query loosely, so a search for "Sony" returns
    // third-party accessories too. Keep only listings that name the brand.
    const brandRe = new RegExp(`(^|[^a-z0-9])${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const mine = outcome.value
      .filter(r => brandRe.test(r.title || ''))
      .slice(0, COUNTRY_PER_BRAND)
      .map(r => ({ ...r, brand }));
    perBrand.push(mine);
  });

  // Interleave, so the page opens with one product from each brand rather
  // than eight of whichever brand happened to answer first.
  const results = [];
  for (let i = 0; i < COUNTRY_PER_BRAND; i++) {
    for (const list of perBrand) if (list[i]) results.push(list[i]);
  }

  return { results, brandsSearched: chosen.filter(b => !failed.includes(b)), failed };
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

module.exports = { searchProducts, searchByBrands, fetchCurrentPrice, SerpApiError, resetSearchCache };
