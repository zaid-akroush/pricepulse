// Derives a "Product Details" panel from the product title. Detailed specs and
// exact release dates aren't part of the Google Shopping data, so brand / model
// / storage / colour / network are parsed from the title, and launch dates come
// from a small built-in lookup of popular phone lines (approximate).

const BRANDS = [
  { re: /\biphone\b|\bapple\b/i, name: 'Apple' },
  { re: /\bgalaxy\b|\bsamsung\b/i, name: 'Samsung' },
  { re: /\bpixel\b|\bgoogle\b/i, name: 'Google' },
  { re: /\boneplus\b/i, name: 'OnePlus' },
  { re: /\bredmi\b|\bxiaomi\b|\bpoco\b/i, name: 'Xiaomi' },
  { re: /\boppo\b/i, name: 'Oppo' },
  { re: /\bvivo\b/i, name: 'Vivo' },
  { re: /\brealme\b/i, name: 'Realme' },
  { re: /\bmotorola\b|\bmoto\b/i, name: 'Motorola' },
  { re: /\bnokia\b/i, name: 'Nokia' },
  { re: /\bsony\b|\bxperia\b/i, name: 'Sony' },
  { re: /\bhuawei\b/i, name: 'Huawei' },
  { re: /\bhonor\b/i, name: 'Honor' },
  { re: /\basus\b|\brog phone\b/i, name: 'Asus' },
  { re: /\bnothing phone\b|\bnothing\b/i, name: 'Nothing' },
  { re: /\bdell\b/i, name: 'Dell' },
  { re: /\bhp\b/i, name: 'HP' },
  { re: /\blenovo\b|\bthinkpad\b/i, name: 'Lenovo' },
  { re: /\bmacbook\b/i, name: 'Apple' },
];

const COLORS = [
  'Black', 'White', 'Blue', 'Red', 'Green', 'Purple', 'Pink', 'Gold', 'Silver',
  'Graphite', 'Titanium', 'Midnight', 'Starlight', 'Gray', 'Grey', 'Yellow',
  'Orange', 'Lavender', 'Mint', 'Cream', 'Coral', 'Teal', 'Bronze', 'Natural',
  'Desert', 'Ultramarine',
];

// Approximate launch dates for popular phone lines (most specific first).
const RELEASES = [
  [/iphone\s*16\s*pro\s*max/i, 'September 2024'],
  [/iphone\s*16\s*pro/i, 'September 2024'],
  [/iphone\s*16\s*plus/i, 'September 2024'],
  [/iphone\s*16e/i, 'February 2025'],
  [/iphone\s*16/i, 'September 2024'],
  [/iphone\s*15\s*pro\s*max/i, 'September 2023'],
  [/iphone\s*15\s*pro/i, 'September 2023'],
  [/iphone\s*15\s*plus/i, 'September 2023'],
  [/iphone\s*15/i, 'September 2023'],
  [/iphone\s*14/i, 'September 2022'],
  [/iphone\s*se.*(2022|3rd)/i, 'March 2022'],
  [/iphone\s*13/i, 'September 2021'],
  [/iphone\s*12/i, 'October 2020'],
  [/iphone\s*11/i, 'September 2019'],
  [/galaxy\s*s25\s*ultra/i, 'January 2025'],
  [/galaxy\s*s25/i, 'January 2025'],
  [/galaxy\s*s24\s*ultra/i, 'January 2024'],
  [/galaxy\s*s24/i, 'January 2024'],
  [/galaxy\s*s23/i, 'February 2023'],
  [/galaxy\s*s22/i, 'February 2022'],
  [/galaxy\s*z\s*fold\s*6/i, 'July 2024'],
  [/galaxy\s*z\s*flip\s*6/i, 'July 2024'],
  [/galaxy\s*z\s*fold\s*5/i, 'August 2023'],
  [/galaxy\s*a55/i, 'March 2024'],
  [/pixel\s*9\s*pro/i, 'August 2024'],
  [/pixel\s*9/i, 'August 2024'],
  [/pixel\s*8\s*pro/i, 'October 2023'],
  [/pixel\s*8a/i, 'May 2024'],
  [/pixel\s*8/i, 'October 2023'],
  [/pixel\s*7/i, 'October 2022'],
  [/oneplus\s*12/i, 'January 2024'],
  [/oneplus\s*11/i, 'February 2023'],
  [/nothing phone\s*\(?2\)?/i, 'July 2023'],
];

export function parseSpecs(title = '') {
  const specs = [];
  const add = (label, value) => value && specs.push({ label, value });

  const brand = BRANDS.find(b => b.re.test(title));
  add('Brand', brand?.name);

  // Storage: take the largest GB/TB figure (TB wins)
  const tb = title.match(/(\d+(?:\.\d+)?)\s?TB\b/i);
  const gbAll = [...title.matchAll(/(\d+)\s?GB\b/gi)].map(m => parseInt(m[1]));
  if (tb) add('Storage', `${tb[1]} TB`);
  else if (gbAll.length) add('Storage', `${Math.max(...gbAll)} GB`);

  const ram = title.match(/(\d+)\s?GB\s?RAM/i);
  add('RAM', ram ? `${ram[1]} GB` : null);

  const color = COLORS.find(c => new RegExp(`\\b${c}\\b`, 'i').test(title));
  add('Colour', color);

  const screen = title.match(/(\d{1,2}(?:\.\d)?)["\s-]*(?:inch|in\b|")/i);
  add('Screen', screen ? `${screen[1]}"` : null);

  if (/\b5G\b/i.test(title)) add('Network', '5G');
  else if (/\b(4G|LTE)\b/i.test(title)) add('Network', '4G LTE');

  if (/\bunlocked\b/i.test(title)) add('SIM', 'Unlocked');
  add('Condition', /\b(renewed|refurbished|refurb)\b/i.test(title) ? 'Refurbished' : 'New');

  return specs;
}

export function getReleaseDate(title = '') {
  const hit = RELEASES.find(([re]) => re.test(title));
  return hit ? hit[1] : null;
}

export default function ProductSpecs({ title }) {
  const specs = parseSpecs(title);
  const released = getReleaseDate(title);
  if (specs.length === 0 && !released) return null;

  return (
    <div className="card p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Product Details</h2>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
          inferred from listing
        </span>
      </div>

      {released && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
          <span className="w-8 h-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Released (approx.)</p>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{released}</p>
          </div>
        </div>
      )}

      {specs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {specs.map(s => (
            <div key={s.label} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text)' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Specifications are parsed from the product title and may be incomplete. Release dates are approximate launch dates for popular models.
      </p>
    </div>
  );
}
