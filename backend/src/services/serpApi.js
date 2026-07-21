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
async function searchProducts(query) {
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
    throw new SerpApiError('Product search is temporarily unavailable. Please try again later.', status || 502);
  }

  const results = data.shopping || [];

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
    const price = typeof item.price === 'number'
      ? item.price
      : (item.price ? parseFloat(String(item.price).replace(/[^0-9.]/g, '')) : null);
    return {
      title: item.title || item.name,
      price,
      currency: 'USD',
      originalPrice: null, // Serper's shopping endpoint doesn't return a pre-discount price
      url: item.link || item.url || null,
      imageUrl: item.imageUrl || item.thumbnail || null,
      source: item.source || null,
      serpApiQuery: query,
      rating: item.rating || null,
      reviews: item.ratingCount || null,
    };
  });

  return normalized.filter(item => {
    if (!item.price || item.price <= 0) return false;
    for (const { pattern, min } of PRICE_FLOORS) {
      if (pattern.test(item.title) && item.price < min) return false;
    }
    // Generic floor: drop anything under $3 (almost certainly a monthly plan)
    if (item.price < 3) return false;
    return true;
  });
}

/**
 * Fetch the current price of a single tracked product by re-running its query
 * and finding the closest title match.
 */
async function fetchCurrentPrice(serpApiQuery, productTitle) {
  const results = await searchProducts(serpApiQuery);
  const match = results.find(
    (r) => r.title && r.title.toLowerCase().includes(productTitle.toLowerCase().slice(0, 20))
  );
  return match ? match.price : null;
}

module.exports = { searchProducts, fetchCurrentPrice, SerpApiError };
