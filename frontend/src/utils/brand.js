// Detect a known electronics brand from a product title and map it to its
// Simple Icons slug (https://simpleicons.org), so we can show a real brand
// logo instead of a generic placeholder. Matching is done on whole words at
// the start of the title where possible, longest brand name first so e.g.
// "Google Pixel" doesn't get swallowed by a shorter partial match.
const BRANDS = [
  { name: 'Apple',      slug: 'apple' },
  { name: 'Samsung',    slug: 'samsung' },
  { name: 'Sony',       slug: 'sony' },
  { name: 'LG',         slug: 'lg' },
  { name: 'Dell',       slug: 'dell' },
  { name: 'HP',         slug: 'hp' },
  { name: 'Lenovo',     slug: 'lenovo' },
  { name: 'Asus',       slug: 'asus' },
  { name: 'Acer',       slug: 'acer' },
  { name: 'Microsoft',  slug: 'microsoft' },
  { name: 'Google',     slug: 'google' },
  { name: 'Amazon',     slug: 'amazon' },
  { name: 'Logitech',   slug: 'logitech' },
  { name: 'Razer',      slug: 'razer' },
  { name: 'Canon',      slug: 'canon' },
  { name: 'Nikon',      slug: 'nikon' },
  { name: 'GoPro',      slug: 'gopro' },
  { name: 'Fitbit',     slug: 'fitbit' },
  { name: 'Garmin',     slug: 'garmin' },
  { name: 'Xiaomi',     slug: 'xiaomi' },
  { name: 'Huawei',     slug: 'huawei' },
  { name: 'OnePlus',    slug: 'oneplus' },
  { name: 'Motorola',   slug: 'motorola' },
  { name: 'Nokia',      slug: 'nokia' },
  { name: 'Philips',    slug: 'philips' },
  { name: 'Panasonic',  slug: 'panasonic' },
  { name: 'Intel',      slug: 'intel' },
  { name: 'AMD',        slug: 'amd' },
  { name: 'Nvidia',     slug: 'nvidia' },
  { name: 'Corsair',    slug: 'corsair' },
  { name: 'Anker',      slug: 'anker' },
  { name: 'Belkin',     slug: 'belkin' },
  { name: 'JBL',        slug: 'jbl' },
].sort((a, b) => b.name.length - a.name.length);

export function detectBrand(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const brand of BRANDS) {
    const needle = brand.name.toLowerCase();
    // word-boundary match so "HP" doesn't match inside "Headphones", etc.
    const re = new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, 'i');
    if (re.test(lower)) return brand;
  }
  return null;
}

// Simple Icons renders in solid black by default. Passing /<slug>/<hexColor>
// recolors it — without this, a brand tile with a dark background (like
// Sony below) renders a black-on-near-black logo that's effectively
// invisible, which is exactly what was happening here.
export function brandLogoUrl(slug, color) {
  const hex = color ? String(color).replace('#', '') : null;
  return hex ? `https://cdn.simpleicons.org/${slug}/${hex}` : `https://cdn.simpleicons.org/${slug}`;
}
