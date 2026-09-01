// Facets pulled out of a listing title.
//
// The shopping API returns a title, a price and a retailer — no structured
// attributes at all. Every filter a shopper actually wants (is this used?
// how much storage? what colour?) is therefore inferred from the title text
// here, once, at the same choke point as the tech/release rules, so search,
// compare and the gallery all see the same values.
//
// Everything is nullable on purpose. A listing that does not state its
// storage must come back as null rather than a guess, because the filters
// treat null as "not stated" and never silently exclude it from a facet the
// listing simply did not mention.

// ── Condition ─────────────────────────────────────────────────────────────
// Order matters: "certified refurbished" must not be read as "certified new",
// and "open box" is its own thing, so the most specific pattern wins.
const CONDITION_RULES = [
  { value: 'refurbished', label: 'Refurbished', re: /\b(refurbish(ed)?|renewed|recertified|certified pre[\s-]?owned)\b/i },
  { value: 'open_box', label: 'Open box', re: /\b(open[\s-]?box|opened box|box damaged)\b/i },
  { value: 'used', label: 'Used', re: /\b(used|pre[\s-]?owned|second[\s-]?hand|grade [abc]\b)/i },
  { value: 'new', label: 'New', re: /\b(brand[\s-]?new|new sealed|factory sealed|sealed)\b/i },
];

function detectCondition(title) {
  for (const rule of CONDITION_RULES) {
    if (rule.re.test(title)) return { value: rule.value, label: rule.label };
  }
  // Unstated condition is NOT the same as "new". Most listings say nothing
  // and are new, but claiming it here would put genuinely unknown listings
  // under a filter a shopper trusts.
  return { value: null, label: null };
}

// ── Storage ───────────────────────────────────────────────────────────────
// Normalised to GB so 1TB and 1024GB land in the same bucket, and sorting is
// numeric rather than alphabetical ("1TB" before "256GB").
const STORAGE_RE = /\b(\d{1,4})\s?(gb|tb)\b/gi;
// Anything at or below this is RAM or an SD card in a phone/laptop title,
// not the device's storage.
const MIN_STORAGE_GB = 16;

function detectStorage(title) {
  const found = [];
  for (const m of String(title).matchAll(STORAGE_RE)) {
    const n = parseInt(m[1], 10);
    if (!n) continue;
    const gb = m[2].toLowerCase() === 'tb' ? n * 1024 : n;
    found.push(gb);
  }
  if (found.length === 0) return null;
  // A title like "8GB RAM 256GB SSD" carries both; the larger figure is the
  // storage, the smaller is memory.
  const gb = Math.max(...found);
  if (gb < MIN_STORAGE_GB) return null;
  return { gb, label: gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB` };
}

function detectRam(title) {
  const m = String(title).match(/\b(\d{1,3})\s?gb\s+(ram|memory)\b/i);
  if (!m) return null;
  const gb = parseInt(m[1], 10);
  return gb ? { gb, label: `${gb}GB` } : null;
}

// ── Colour ────────────────────────────────────────────────────────────────
// Marketing names are mapped onto the basic colour a person would filter by:
// nobody scans a list for "Titanium Natural", they look for "Silver".
const COLOURS = [
  { label: 'Black', re: /\b(black|midnight|graphite|space gray|space grey|obsidian|onyx|carbon)\b/i },
  { label: 'White', re: /\b(white|starlight|porcelain|snow|moonlight)\b/i },
  { label: 'Silver', re: /\b(silver|platinum|titanium|steel|aluminium|aluminum)\b/i },
  { label: 'Gold', re: /\b(gold|champagne|bronze|copper)\b/i },
  { label: 'Blue', re: /\b(blue|navy|sierra|pacific|sapphire|teal|cyan)\b/i },
  { label: 'Green', re: /\b(green|alpine|mint|olive|emerald|jade)\b/i },
  { label: 'Red', re: /\b(red|crimson|scarlet|maroon)\b/i },
  { label: 'Purple', re: /\b(purple|violet|lavender|lilac|deep purple)\b/i },
  { label: 'Pink', re: /\b(pink|rose gold|rose|coral|magenta)\b/i },
  { label: 'Yellow', re: /\b(yellow|amber|mustard)\b/i },
  { label: 'Orange', re: /\b(orange|sunset)\b/i },
  { label: 'Grey', re: /\b(gray|grey|slate|ash)\b/i },
];

function detectColour(title) {
  // Whichever colour word appears FIRST in the title wins, not whichever is
  // first in this list. "Blue Titanium" is a blue phone: list order would
  // have called it Silver, because 'titanium' happens to be listed earlier.
  let best = null;
  for (const c of COLOURS) {
    const m = String(title).match(c.re);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, label: c.label };
  }
  return best ? best.label : null;
}

// ── Screen size ───────────────────────────────────────────────────────────
// Inches, as written on TVs, monitors, laptops and tablets.
function detectScreenInches(title) {
  const m = String(title).match(/\b(\d{1,2}(?:\.\d)?)\s?(?:"|''|-?\s?inch(?:es)?\b)/i);
  if (!m) return null;
  const inches = parseFloat(m[1]);
  return inches >= 4 && inches <= 120 ? inches : null;
}

// ── Brand ─────────────────────────────────────────────────────────────────
// A known-brand list rather than "first word of the title", because listings
// routinely begin with a retailer or a marketing prefix.
const BRANDS = [
  'Apple', 'Samsung', 'Google', 'Sony', 'LG', 'Microsoft', 'Dell', 'HP',
  'Lenovo', 'Asus', 'Acer', 'MSI', 'Razer', 'Xiaomi', 'Huawei', 'Honor',
  'OnePlus', 'Oppo', 'Vivo', 'Realme', 'Motorola', 'Nokia', 'Nothing',
  'Nintendo', 'Bose', 'JBL', 'Sennheiser', 'Beats', 'Anker', 'Belkin',
  'Logitech', 'Corsair', 'SteelSeries', 'HyperX', 'Garmin', 'Fitbit',
  'GoPro', 'DJI', 'Canon', 'Nikon', 'Fujifilm', 'Panasonic', 'Philips',
  'TCL', 'Hisense', 'Toshiba', 'Sharp', 'Intel', 'AMD', 'Nvidia', 'NVIDIA',
  'Seagate', 'Western Digital', 'SanDisk', 'Kingston', 'Crucial', 'Amazon',
  'Roku', 'Sonos', 'Ring', 'Arlo', 'Dyson', 'Roborock', 'Ecovacs', 'Tuf',
];
const BRAND_RES = BRANDS.map(b => ({
  label: b,
  re: new RegExp(`(^|[^a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i'),
}));

function detectBrand(title) {
  for (const b of BRAND_RES) if (b.re.test(title)) return b.label;
  return null;
}

/**
 * Every facet for one listing, from its title.
 * @param {string} title
 * @returns {{condition: string|null, conditionLabel: string|null, storageGb: number|null, storageLabel: string|null, ramGb: number|null, color: string|null, screenInches: number|null, brand: string|null}}
 */
function extractAttributes(title) {
  const t = String(title || '');
  if (!t) {
    return {
      condition: null, conditionLabel: null, storageGb: null, storageLabel: null,
      ramGb: null, color: null, screenInches: null, brand: null,
    };
  }
  const condition = detectCondition(t);
  const storage = detectStorage(t);
  const ram = detectRam(t);
  return {
    condition: condition.value,
    conditionLabel: condition.label,
    storageGb: storage ? storage.gb : null,
    storageLabel: storage ? storage.label : null,
    ramGb: ram ? ram.gb : null,
    color: detectColour(t),
    screenInches: detectScreenInches(t),
    brand: detectBrand(t),
  };
}

module.exports = { extractAttributes, CONDITION_RULES, COLOURS, BRANDS };
