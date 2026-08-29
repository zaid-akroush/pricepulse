// Classification rules applied to every shopping result before it can enter
// the app: is this actually a tech product, and has it been released yet?
//
// Both questions are answered from the listing title alone. That's a
// deliberate constraint — the shopping API gives us no reliable category
// field, and re-querying per result would multiply paid API calls — so these
// are keyword rules, kept in one place, deterministic, and unit-testable
// without a network call.

// ── Tech / non-tech ───────────────────────────────────────────────────────
//
// This is a price tracker for consumer electronics. Searching a word like
// "china" or "apple" used to return dinnerware and fruit, because the
// shopping API just answers the query it's given. A result has to look like
// electronics to get through.

// Product types we track. Matched as whole words so "tv" doesn't fire inside
// "tvs" is fine but "atv" isn't matched, and "pc" doesn't fire inside "pcs".
const TECH_TERMS = [
  // phones / wearables
  'smartphone', 'phone', 'iphone', 'galaxy', 'pixel', 'android', 'smartwatch',
  'smart watch', 'fitness tracker', 'earbuds', 'airpods', 'headphone',
  'headphones', 'headset', 'earphones', 'speaker', 'soundbar', 'subwoofer',
  // computing
  'laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook', 'desktop',
  'computer', 'pc', 'imac', 'tablet', 'ipad', 'monitor', 'display',
  'keyboard', 'mouse', 'webcam', 'printer', 'scanner', 'router', 'modem',
  'nas', 'server',
  // components
  'gpu', 'graphics card', 'cpu', 'processor', 'motherboard', 'ram',
  'memory', 'ssd', 'hdd', 'hard drive', 'solid state', 'power supply', 'psu',
  'cooler', 'heatsink', 'gpu cooler', 'pc case', 'geforce', 'radeon', 'rtx',
  'gtx', 'ryzen', 'core i3', 'core i5', 'core i7', 'core i9', 'threadripper',
  // gaming
  'console', 'playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch',
  'gaming', 'controller', 'joystick', 'vr headset', 'oculus', 'steam deck',
  // av / home
  'tv', 'television', 'oled', 'qled', 'projector', 'blu-ray', 'streaming stick',
  'camera', 'dslr', 'mirrorless', 'camcorder', 'gopro', 'drone', 'lens',
  'smart home', 'smart bulb', 'smart plug', 'thermostat', 'doorbell',
  'security camera', 'alexa', 'echo dot', 'google nest', 'nest hub',
  'robot vacuum', 'roomba', 'air purifier', 'smart scale',
  // Product families whose names never contain a generic category word.
  // Without these, real electronics ("Apple Watch Series 9", "Kindle
  // Paperwhite", "Anker PowerCore") were classified as non-tech.
  'watch', 'kindle', 'e-reader', 'ereader', 'paperwhite', 'fire tablet',
  'powercore', 'soundcore', 'airtag', 'chromecast', 'roku', 'fire stick',
  'forerunner', 'venu', 'vivoactive', 'instinct', 'galaxy watch',
  'apple watch', 'quest', 'shield tv', 'homepod', 'macbook air',
  // Laptop and phone model families. A listing is often just a brand and a
  // model name ("Lenovo ThinkPad X1 Carbon", "Redmi Note 13") with no
  // category word anywhere, and those were being dropped as non-tech.
  'thinkpad', 'ideapad', 'legion', 'yoga', 'thinkbook', 'matebook',
  'zenbook', 'vivobook', 'rog', 'tuf', 'predator', 'nitro', 'aspire',
  'swift', 'latitude', 'inspiron', 'xps', 'alienware', 'precision',
  'pavilion', 'envy', 'spectre', 'omen', 'victus', 'elitebook', 'probook',
  'surface pro', 'surface laptop', 'framework laptop',
  'redmi', 'poco', 'oneplus', 'nothing phone', 'moto g', 'moto edge',
  'zenfone', 'xperia', 'reno', 'find x', 'magic v', 'mate xt',
  // accessories
  'charger', 'charging', 'power bank', 'usb', 'usb-c', 'hdmi', 'ethernet',
  'adapter', 'docking station', 'hub', 'cable', 'battery', 'sd card',
  'micro sd', 'flash drive', 'phone case', 'screen protector',
];

// Categories that share vocabulary with tech but aren't tech. If one of these
// matches and no tech term does, the result is dropped; when both match, the
// tech term wins ("kitchen scale" is out, "smart kitchen scale" is in).
const NON_TECH_TERMS = [
  'dinnerware', 'dinner set', 'plate set', 'porcelain', 'ceramic', 'stoneware',
  'mug', 'cutlery', 'flatware', 'silverware', 'cookware', 'saucepan', 'skillet',
  'bedding', 'duvet', 'comforter', 'pillow', 'mattress', 'towel', 'curtain',
  'sofa', 'couch', 'armchair', 'dining table', 'wardrobe', 'dresser', 'rug',
  'shirt', 'tshirt', 't-shirt', 'jeans', 'dress', 'shoes', 'sneakers', 'boots',
  'handbag', 'purse', 'wallet', 'perfume', 'cologne', 'lipstick', 'shampoo',
  'vitamin', 'supplement', 'protein powder', 'snack', 'candy', 'chocolate',
  'coffee beans', 'tea bags', 'cereal', 'grocery',
  'toy', 'puzzle', 'board game', 'lego', 'doll', 'plush',
  'book', 'novel', 'paperback', 'hardcover', 'cookbook',
  'garden', 'lawn mower', 'fertilizer', 'seeds', 'plant pot',
  'tire', 'motor oil', 'windshield', 'car seat',
  // Tableware and decor, the categories a country name pulls in hardest:
  // "china" is both a country and a word for porcelain.
  'place setting', 'dinner plate', 'salad plate', 'tableware', 'glassware',
  'teapot', 'tea set', 'coffee set', 'serving bowl', 'platter', 'tureen',
  'vase', 'candle', 'ornament', 'figurine', 'tablecloth', 'napkin',
  'jewelry', 'necklace', 'bracelet', 'earrings', 'watch band', 'watch strap',
];

// Terms that are real electronics vocabulary but also appear in ordinary
// English about non-tech goods. On their own they are not enough to call
// something a gadget: "5-pc Place Setting" matched 'pc', which is how a
// $550 porcelain dinner service ended up in a search for "china".
//
// A title carried by one of these alone is only accepted when nothing marks
// it as another category — see isTechProduct.
const AMBIGUOUS_TECH_TERMS = new Set([
  'pc', 'watch', 'switch', 'hub', 'cable', 'battery', 'adapter', 'charger',
  'charging', 'memory', 'display', 'speaker', 'lens', 'usb', 'set', 'case',
  'controller', 'gaming', 'computer',
]);

// "5-pc", "12 pc", "20-piece" are counts of dinnerware and cutlery, never a
// reference to a personal computer. Removed before matching so 'pc' cannot
// fire on them at all.
const PIECE_COUNT_RE = /\b\d+\s*-?\s*(pc|pcs|piece|pieces)\b/gi;

function wordRe(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

const TECH_RES = TECH_TERMS.map(wordRe);
const NON_TECH_RES = NON_TECH_TERMS.map(wordRe);

/**
 * Does this listing look like a consumer-electronics product?
 * @param {string} title listing title
 * @returns {boolean}
 */
function isTechProduct(title) {
  if (!title || typeof title !== 'string') return false;

  const cleaned = title.replace(PIECE_COUNT_RE, ' ');

  const matched = TECH_TERMS.filter((term, i) => TECH_RES[i].test(cleaned));
  if (matched.length === 0) return false;

  // A strong term (one that only ever describes electronics) is decisive.
  if (matched.some(term => !AMBIGUOUS_TECH_TERMS.has(term))) return true;

  // Only ambiguous terms matched. Now the non-tech list decides: it is the
  // difference between "Apple Watch Series 9" (keep) and "Porcelain Tea Set"
  // or a dinnerware place setting (drop).
  return !isClearlyNonTech(cleaned);
}

/** True when the title is clearly a non-tech category. Used for messaging. */
function isClearlyNonTech(title) {
  return Boolean(title) && NON_TECH_RES.some(re => re.test(title));
}

// ── Release status ────────────────────────────────────────────────────────
//
// Shopping results routinely include products that can be ordered but not
// yet shipped. Showing a pre-order at the same visual weight as a product
// you can buy today is misleading — and its "price history" is a single
// speculative number — so unreleased products are labelled explicitly.

// NOTE: this deliberately does NOT match "available from <retailer>" or
// "ships from <place>". Those are ordinary in-stock listing boilerplate and
// matching them labelled shipping copy as a pre-order.
const PREORDER_RE = /\b(pre[\s-]?order|preorder|pre[\s-]?sale|presale|coming soon|releases? (on|in)|launch(es|ing)? (on|in)|back[\s-]?order|reserve (now|yours)|not yet released|unreleased|ships? (in|by) (early|late|mid)?\s?(january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]))\b/i;

// "2027 model", "(2026)" — a model year in the future is an unreleased product.
function futureModelYear(title, now = new Date()) {
  const currentYear = now.getFullYear();
  const years = String(title).match(/\b(20\d{2})\b/g) || [];
  for (const y of years) {
    const year = parseInt(y, 10);
    if (year > currentYear) return year;
  }
  return null;
}

/**
 * Work out whether a listing is for something not yet on sale.
 * @param {string} title
 * @param {Date} [now] injectable for tests
 * @returns {{released: boolean, reason: string|null, label: string|null}}
 */
function getReleaseStatus(title, now = new Date()) {
  if (!title) return { released: true, reason: null, label: null };

  if (PREORDER_RE.test(title)) {
    return {
      released: false,
      reason: 'preorder',
      label: 'Not released yet — pre-order',
    };
  }

  const year = futureModelYear(title, now);
  if (year) {
    return {
      released: false,
      reason: 'future_model_year',
      label: `Not released yet — ${year} model`,
    };
  }

  return { released: true, reason: null, label: null };
}

module.exports = {
  isTechProduct,
  isClearlyNonTech,
  getReleaseStatus,
  TECH_TERMS,
  NON_TECH_TERMS,
};
