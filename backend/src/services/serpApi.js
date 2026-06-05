const axios = require('axios');

const SERP_API_KEY = process.env.SERP_API_KEY;
const VALUESERP_BASE = 'https://api.valueserp.com/search';

/**
 * Search Google Shopping for products matching query.
 * Returns an array of normalized product objects.
 */
async function searchProducts(query) {
  if (!SERP_API_KEY) throw new Error('SERP_API_KEY is not set');

  const { data } = await axios.get(VALUESERP_BASE, {
    params: {
      api_key: SERP_API_KEY,
      q: query,
      tbm: 'shop',
    },
  });

  // shopping_graphs is an array of arrays — flatten it
  const raw = data.shopping_graphs || data.shopping_results || [];
  const results = Array.isArray(raw[0]) ? raw[0] : raw;

  return results.map((item) => ({
    title: item.title || item.name,
    price: item.price_parsed?.value ?? (item.price ? parseFloat(item.price.replace(/[^0-9.]/g, '')) : null),
    currency: 'USD',
    url: item.link || item.url || null,
    imageUrl: item.image || item.thumbnail || null,
    source: item.stores_that_sell || item.source || null,
    serpApiQuery: query,
    rating: item.rating || null,
    reviews: item.reviews || null,
  }));
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

module.exports = { searchProducts, fetchCurrentPrice };
