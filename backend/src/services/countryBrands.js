// Country → tech brands, so searching a country name returns electronics
// from that country instead of whatever the shopping API free-associates.
//
// Typing "china" used to return porcelain, because the query is passed
// straight through and the word means two things. A country name is almost
// never a product search: it is a question about origin. This turns it into
// searches for that country's actual electronics brands.
//
// "From country X" means the BRAND is headquartered there. It deliberately
// does not mean assembled there — nearly all consumer electronics are
// manufactured in China regardless of brand, and no shopping API reports a
// country of manufacture, so an origin claim of that kind would be invented.
// The UI says "brands headquartered in …" for exactly this reason.

const COUNTRIES = [
  {
    country: 'China',
    demonyms: ['chinese', 'prc', "people's republic of china", 'cn'],
    brands: ['Xiaomi', 'Huawei', 'Lenovo', 'Honor', 'Oppo', 'Vivo', 'OnePlus', 'DJI', 'TCL', 'Anker', 'Hisense', 'Realme'],
  },
  {
    country: 'South Korea',
    demonyms: ['korea', 'korean', 'south korean', 'republic of korea', 'kr'],
    brands: ['Samsung', 'LG', 'SK Hynix'],
  },
  {
    country: 'Japan',
    demonyms: ['japanese', 'jp', 'nippon'],
    brands: ['Sony', 'Nintendo', 'Panasonic', 'Canon', 'Nikon', 'Sharp', 'Casio', 'Fujifilm', 'Toshiba', 'JVC'],
  },
  {
    country: 'United States',
    demonyms: ['usa', 'us', 'america', 'american', 'united states of america', 'u.s.', 'u.s.a.'],
    brands: ['Apple', 'Dell', 'HP', 'Microsoft', 'Google', 'Amazon', 'Intel', 'AMD', 'NVIDIA', 'Bose', 'GoPro', 'Garmin'],
  },
  {
    country: 'Taiwan',
    demonyms: ['taiwanese', 'tw', 'republic of china'],
    brands: ['ASUS', 'Acer', 'MSI', 'HTC', 'Gigabyte', 'BenQ', 'TSMC'],
  },
  {
    country: 'Germany',
    demonyms: ['german', 'deutschland', 'de'],
    brands: ['Sennheiser', 'Beyerdynamic', 'Siemens', 'Bosch', 'Leica', 'Teufel'],
  },
  {
    country: 'Netherlands',
    demonyms: ['dutch', 'holland', 'nl'],
    brands: ['Philips', 'ASML', 'NXP'],
  },
  {
    country: 'United Kingdom',
    demonyms: ['uk', 'britain', 'british', 'england', 'english', 'great britain', 'gb'],
    brands: ['Dyson', 'Bowers & Wilkins', 'Arm', 'Raspberry Pi', 'Cambridge Audio'],
  },
  {
    country: 'France',
    demonyms: ['french', 'fr'],
    brands: ['Archos', 'Devialet', 'Focal', 'Withings', 'Parrot'],
  },
  {
    country: 'Sweden',
    demonyms: ['swedish', 'se'],
    brands: ['Ericsson', 'Sennheiser Sweden', 'Urbanista', 'Jays'],
  },
  {
    country: 'Denmark',
    demonyms: ['danish', 'dk'],
    brands: ['Bang & Olufsen', 'Jabra', 'Libratone'],
  },
  {
    country: 'Finland',
    demonyms: ['finnish', 'fi'],
    brands: ['Nokia', 'Polar', 'HMD'],
  },
  {
    country: 'India',
    demonyms: ['indian', 'in', 'bharat'],
    brands: ['boAt', 'Micromax', 'Lava', 'Noise', 'Fire-Boltt'],
  },
  {
    country: 'Canada',
    demonyms: ['canadian', 'ca'],
    brands: ['BlackBerry', 'Nanoleaf', 'EcoFlow Canada'],
  },
  {
    country: 'Switzerland',
    demonyms: ['swiss', 'ch'],
    brands: ['Logitech', 'Tissot', 'Swatch'],
  },
  {
    country: 'Israel',
    demonyms: ['israeli', 'il'],
    brands: ['Mobileye', 'Wix Hardware', 'SolarEdge'],
  },
  {
    country: 'Vietnam',
    demonyms: ['vietnamese', 'vn'],
    brands: ['VinSmart', 'Asanzo', 'BKAV'],
  },
  {
    country: 'Singapore',
    demonyms: ['singaporean', 'sg'],
    brands: ['Creative', 'Razer', 'Flexound'],
  },
  {
    country: 'Spain',
    demonyms: ['spanish', 'es'],
    brands: ['BQ', 'SPC', 'Energy Sistem'],
  },
  {
    country: 'Italy',
    demonyms: ['italian', 'it'],
    brands: ['Olivetti', 'Nilox', 'Sonus Faber'],
  },
  {
    country: 'Turkey',
    demonyms: ['turkish', 'tr', 'türkiye', 'turkiye'],
    brands: ['Vestel', 'Casper', 'Arçelik'],
  },
  {
    country: 'Brazil',
    demonyms: ['brazilian', 'br'],
    brands: ['Positivo', 'Multilaser', 'Gradiente'],
  },
];

// Built once: every spelling that should resolve to a country entry.
const LOOKUP = new Map();
for (const entry of COUNTRIES) {
  LOOKUP.set(entry.country.toLowerCase(), entry);
  for (const alias of entry.demonyms) LOOKUP.set(alias.toLowerCase(), entry);
}

/**
 * Is this query just a country name (or demonym)?
 *
 * Only an EXACT match counts. "chinese" resolves; "chinese phone case" does
 * not, because that is a normal product search the user typed on purpose and
 * rewriting it would take away their control of their own query.
 *
 * @param {string} query
 * @returns {{country: string, brands: string[]} | null}
 */
function matchCountry(query) {
  const key = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const entry = LOOKUP.get(key);
  return entry ? { country: entry.country, brands: entry.brands } : null;
}

/** Every country name, for the frontend's hint text. */
function allCountries() {
  return COUNTRIES.map(c => c.country);
}

module.exports = { matchCountry, allCountries, COUNTRIES };
