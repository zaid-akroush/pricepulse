import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn, Stagger, StaggerItem } from '../components/motion';

/* ── SVG icons for each accessory category ─────────────────────────── */
const icons = {
  Cases: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="10" y="4" width="20" height="32" rx="4"/>
      <rect x="14" y="8" width="12" height="20" rx="2" fill="currentColor" opacity="0.15"/>
    </svg>
  ),
  Chargers: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="10" y="8" width="20" height="16" rx="3"/>
      <path d="M20 24v6M16 30h8"/>
      <path d="M16 13v4M24 13v4"/>
    </svg>
  ),
  Cables: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M6 20h8M26 20h8"/>
      <rect x="14" y="16" width="12" height="8" rx="2"/>
      <path d="M10 16v8M30 16v8"/>
    </svg>
  ),
  Earbuds: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="14" cy="24" r="5"/>
      <circle cx="26" cy="24" r="5"/>
      <path d="M14 19v-5a6 6 0 0 1 12 0v5"/>
      <circle cx="14" cy="24" r="2" fill="currentColor" opacity="0.3"/>
      <circle cx="26" cy="24" r="2" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
  'Power Banks': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="6" y="13" width="28" height="14" rx="3"/>
      <rect x="9" y="16" width="14" height="8" rx="1" fill="currentColor" opacity="0.2"/>
      <path d="M36 17v6"/>
      <path d="M21 20h6M24 17v6"/>
    </svg>
  ),
  'Screen Protectors': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="10" y="4" width="20" height="32" rx="3"/>
      <rect x="13" y="7" width="14" height="26" rx="1" fill="currentColor" opacity="0.15"/>
      <path d="M13 7l14 26"/>
    </svg>
  ),
  Stands: (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="10" y="6" width="20" height="18" rx="3"/>
      <path d="M20 24v8M14 32h12"/>
    </svg>
  ),
  'Car Mounts': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="20" cy="22" r="4"/>
      <path d="M20 18v-8M16 14h8"/>
      <path d="M8 30c0-4 3-6 6-6h12c3 0 6 2 6 6"/>
    </svg>
  ),
  'MagSafe': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="20" cy="20" r="12"/>
      <circle cx="20" cy="20" r="6"/>
      <circle cx="20" cy="20" r="2" fill="currentColor"/>
    </svg>
  ),
  'Keyboards': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="4" y="11" width="32" height="18" rx="3"/>
      <path d="M9 17h2M14 17h2M19 17h2M24 17h2M29 17h2M9 23h22"/>
    </svg>
  ),
  'Stylus Pens': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M10 30L8 32l4-1-1-1z" fill="currentColor"/>
      <path d="M10 30l20-20 2 2-20 20"/>
      <path d="M28 12l2 2"/>
    </svg>
  ),
  'Smartwatch Bands': (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <rect x="13" y="13" width="14" height="14" rx="3"/>
      <path d="M16 13V9a2 2 0 0 1 8 0v4M16 27v4a2 2 0 0 0 8 0v-4"/>
    </svg>
  ),
};

const CATEGORIES = [
  { label: 'Cases',              q: 'phone case' },
  { label: 'Chargers',           q: 'USB-C charger fast charging' },
  { label: 'Cables',             q: 'USB-C cable braided' },
  { label: 'Earbuds',            q: 'wireless earbuds' },
  { label: 'Power Banks',        q: 'power bank portable charger' },
  { label: 'Screen Protectors',  q: 'screen protector tempered glass' },
  { label: 'Stands',             q: 'phone stand desk mount' },
  { label: 'Car Mounts',         q: 'phone car mount' },
  { label: 'MagSafe',            q: 'MagSafe accessories' },
  { label: 'Keyboards',          q: 'bluetooth keyboard compact' },
  { label: 'Stylus Pens',        q: 'stylus pen tablet' },
  { label: 'Smartwatch Bands',   q: 'smartwatch band strap' },
];

const FEATURED = [
  { label: 'iPhone Accessories',   q: 'iPhone accessories' },
  { label: 'Samsung Accessories',  q: 'Samsung accessories' },
  { label: 'iPad Accessories',     q: 'iPad accessories' },
  { label: 'MacBook Accessories',  q: 'MacBook accessories' },
];

/* Example accessory products with real prices/discounts, so the page shows
   actual shoppable-looking cards rather than only category buttons and text
   chips. Each has a self-contained shaded illustration (no external image
   dependency) matching its icon glyph above, scaled up. */
const FEATURED_PRODUCTS = [
  { title: 'MagSafe Charger 15W', icon: 'MagSafe', price: 28.99, was: 39.99, q: 'MagSafe charger 15W' },
  { title: 'Clear Shockproof Case', icon: 'Cases', price: 14.99, was: 24.99, q: 'clear shockproof phone case' },
  { title: 'Braided USB-C Cable 6ft', icon: 'Cables', price: 9.99, was: 16.99, q: 'braided USB-C cable 6ft' },
  { title: 'ANC Wireless Earbuds', icon: 'Earbuds', price: 49.99, was: 79.99, q: 'ANC wireless earbuds' },
  { title: '20,000mAh Power Bank', icon: 'Power Banks', price: 34.99, was: 54.99, q: '20000mAh power bank' },
  { title: 'Tempered Glass Screen Protector', icon: 'Screen Protectors', price: 7.99, was: 12.99, q: 'tempered glass screen protector' },
  { title: 'Adjustable Desk Phone Stand', icon: 'Stands', price: 16.99, was: 22.99, q: 'adjustable desk phone stand' },
  { title: 'Magnetic Car Vent Mount', icon: 'Car Mounts', price: 12.99, was: 19.99, q: 'magnetic car vent mount' },
];

/* Shaded illustration for the hero preview card — a MagSafe charger disc
   with a cable, matching the treatment used elsewhere for product photos
   (shading + gradient, not a flat line icon) so it reads as an actual
   accessory instead of a generic bullseye-shaped glyph. */
function MagSafeArt() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Coiled cable, drawn as a thin curved line (not a filled shape) so it
          reads as a cord rather than a head-and-shoulders silhouette. */}
      <path d="M50 66 C 34 72, 30 84, 42 90 C 52 94, 58 88, 54 82" fill="none" stroke="#2a2a2a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="38" r="30" fill="url(#magsafeRing)" />
      <circle cx="50" cy="38" r="22" fill="#e5e5e5" />
      <circle cx="50" cy="38" r="10" fill="none" stroke="#eb6200" strokeWidth="2.5" />
      <circle cx="50" cy="38" r="3" fill="#eb6200" />
      <defs>
        <linearGradient id="magsafeRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f4" />
          <stop offset="1" stopColor="#c7c7c7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* Simple accessory "product card" using the category icon as a stand-in
   photo (scaled up inside a tinted tile) since these are illustrative
   examples, not real tracked listings. */
function AccessoryCard({ item, onClick }) {
  const discount = Math.round((1 - item.price / item.was) * 100);
  return (
    <button onClick={onClick} className="w-full text-left card card-hover p-4 flex flex-col gap-3 group">
      <div className="w-full aspect-square rounded-xl bg-brand-soft text-brand flex items-center justify-center relative group-hover:scale-[1.02] transition-transform">
        {discount > 0 && (
          <span className="absolute top-2 left-2 z-10 rounded-md bg-danger text-white text-[10px] font-bold px-1.5 py-1 leading-none">
            {discount}% OFF
          </span>
        )}
        <span className="w-12 h-12 [&_svg]:w-full [&_svg]:h-full">{icons[item.icon]}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-app leading-snug mb-1.5 line-clamp-2 min-h-[2rem]">{item.title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-lg price-tag">${item.price.toFixed(2)}</span>
          {item.was > item.price && <span className="text-xs text-faint line-through">${item.was.toFixed(2)}</span>}
        </div>
      </div>
    </button>
  );
}

export default function Accessories() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function goSearch(q) {
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim()) goSearch(query.trim());
  }

  return (
    <div className="bg-app min-h-screen">
      {/* Header: left-aligned, split with a small preview tile */}
      <div className="bg-app-subtle border-b border-app py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <FadeIn>
            <p className="eyebrow mb-3">Track &amp; save</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 leading-tight text-app">
              Phone & Device<br />
              <span className="text-brand">Accessories</span>
            </h1>
            <p className="text-muted text-base mb-8 max-w-lg">
              Find the best prices on cases, chargers, cables, earbuds, and more, then track them and get alerted when prices drop.
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder='Search accessories, e.g. "MagSafe charger", "AirTag case"'
                  className="input pl-10 py-3.5"
                />
              </div>
              <button type="submit" className="btn-primary px-6 whitespace-nowrap">Search</button>
            </form>
          </FadeIn>
          <FadeIn delay={0.1} className="hidden lg:flex justify-center">
            <div className="animate-float card p-5 w-56 -rotate-2">
              <div className="w-full aspect-square surface-2 rounded-xl flex items-center justify-center mb-3 p-6">
                <MagSafeArt />
              </div>
              <p className="text-xs font-semibold text-app leading-snug">MagSafe Charger 15W</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="price-tag text-lg">$28.99</p>
                <p className="text-xs text-faint line-through">$39.99</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-14">

        {/* Featured brands */}
        <section>
          <h2 className="text-2xl font-bold text-app mb-2 tracking-tight">Shop by Brand</h2>
          <p className="text-sm text-muted mb-6">Browse accessories for your device brand</p>
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" stagger={0.05}>
            {FEATURED.map(f => (
              <StaggerItem key={f.label}>
                <button
                  onClick={() => goSearch(f.q)}
                  className="w-full text-left p-6 rounded-2xl card card-hover group"
                >
                  <p className="font-bold text-lg leading-tight text-app">{f.label}</p>
                  <p className="text-muted text-xs mt-1 group-hover:text-brand transition-colors">Browse all &rarr;</p>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Featured products: real shoppable-looking cards with prices and
            discounts, so the page isn't purely category buttons and chips. */}
        <section>
          <h2 className="text-2xl font-bold text-app mb-2 tracking-tight">Featured Accessories</h2>
          <p className="text-sm text-muted mb-6">Popular picks people are tracking right now</p>
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" stagger={0.05}>
            {FEATURED_PRODUCTS.map(item => (
              <StaggerItem key={item.title}>
                <AccessoryCard item={item} onClick={() => goSearch(item.q)} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Category grid */}
        <section>
          <h2 className="text-2xl font-bold text-app mb-2 tracking-tight">Browse by Category</h2>
          <p className="text-sm text-muted mb-6">Find exactly what you're looking for</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.label}
                onClick={() => goSearch(cat.q)}
                className="w-full flex flex-row items-center gap-3 p-3 rounded-2xl card card-hover group"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                  {icons[cat.label]}
                </div>
                <span className="text-sm font-semibold text-app group-hover:text-brand transition-colors text-left leading-tight">{cat.label}</span>
                <svg className="w-4 h-4 text-faint ml-auto shrink-0 group-hover:text-brand group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            ))}
          </div>
        </section>

        {/* Popular searches */}
        <section>
          <h2 className="text-2xl font-bold text-app mb-2 tracking-tight">Popular Searches</h2>
          <p className="text-sm text-muted mb-6">Trending accessory searches right now</p>
          <div className="flex flex-wrap gap-2">
            {[
              'MagSafe wallet', 'USB-C hub', 'AirTag', 'iPhone 15 case', 'wireless charger',
              'Lightning cable', 'iPad keyboard', 'Apple Watch band', 'Anker charger',
              'Spigen case', 'Belkin MagSafe', 'Samsung Galaxy case', 'type-c to headphone',
              'phone ring holder', 'portable battery', 'gaming controller grip',
            ].map(term => (
              <button
                key={term}
                onClick={() => goSearch(term)}
                className="chip"
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        {/* Info banner */}
        <section className="bg-brand rounded-3xl p-8 text-on-brand flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Never overpay for accessories</h3>
            <p className="text-sm leading-relaxed opacity-90">
              Add any accessory to your wishlist, set a target price, and get an email the moment it drops. Works for cases, chargers, cables, and anything else you find on PricePulse.
            </p>
          </div>
          <div className="flex gap-3 shrink-0 flex-wrap justify-center">
            <button onClick={() => goSearch('phone accessories')} className="bg-[var(--on-brand)] text-brand-strong font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-float text-sm">
              Start Searching →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
