import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ProductCardSkeleton } from '../components/Skeleton';
import ProductImage from '../components/ProductImage';
import DealScore from '../components/DealScore';
import Price from '../components/Price';
import { FadeIn, Stagger, StaggerItem, spring } from '../components/motion';
import BrandLogo from '../components/BrandLogo';
// Deep-imported per icon (not the top-level barrel) — the package ships
// 1650+ icons re-exported from one giant index, and pulling all of them
// through a single barrel import made local production builds take
// several minutes. Importing each icon's own small module keeps the build
// fast and the shipped bundle limited to just the 9 icons actually used.
import { DeviceMobileSpeaker as DeviceMobile } from '@phosphor-icons/react/dist/csr/DeviceMobileSpeaker';
import { Laptop } from '@phosphor-icons/react/dist/csr/Laptop';
import { Headphones as HeadphonesIcon } from '@phosphor-icons/react/dist/csr/Headphones';
import { GameController } from '@phosphor-icons/react/dist/csr/GameController';
import { Camera as CameraIcon } from '@phosphor-icons/react/dist/csr/Camera';
import { DeviceTablet } from '@phosphor-icons/react/dist/csr/DeviceTablet';
import { Television } from '@phosphor-icons/react/dist/csr/Television';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { Cpu } from '@phosphor-icons/react/dist/csr/Cpu';

/* Small inline icon set used in place of emoji throughout this page. */
const Icon = {
  bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  chart: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18" /><path d="M7 15l4-6 3 4 5-8" />
    </svg>
  ),
  globe: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
    </svg>
  ),
  bolt: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" />
    </svg>
  ),
  users: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3-6 7-6s7 2.7 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c2.3.4 4 2.2 4 4.8" />
    </svg>
  ),
  heart: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 21s-7.5-4.6-10-9.1C.5 8.2 2.4 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c3.6 0 5.5 3.2 4 6.9C19.5 16.4 12 21 12 21z" />
    </svg>
  ),
  target: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  scale: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v18M5 8l-3 6a3 3 0 0 0 6 0l-3-6zM19 8l-3 6a3 3 0 0 0 6 0l-3-6zM5 8h14M9 21h6" />
    </svg>
  ),
  link: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
    </svg>
  ),
};

/* Category icons, from @phosphor-icons/react (MIT-licensed) rendered with
   the "duotone" weight — a filled two-tone glyph (solid shape + a lighter
   currentColor-opacity fill behind it) instead of a plain thin outline, so
   they read as more substantial than a simple line-art stroke icon. */
const ICON_CLS = 'w-9 h-9 sm:w-11 sm:h-11';
const icons = {
  Smartphones: <DeviceMobile className={ICON_CLS} weight="duotone" />,
  Laptops: <Laptop className={ICON_CLS} weight="duotone" />,
  Headphones: <HeadphonesIcon className={ICON_CLS} weight="duotone" />,
  Gaming: <GameController className={ICON_CLS} weight="duotone" />,
  Cameras: <CameraIcon className={ICON_CLS} weight="duotone" />,
  Tablets: <DeviceTablet className={ICON_CLS} weight="duotone" />,
  TVs: <Television className={ICON_CLS} weight="duotone" />,
  'Smart Home': <House className={ICON_CLS} weight="duotone" />,
  'PC Parts': <Cpu className={ICON_CLS} weight="duotone" />,
};

const CATEGORIES = [
  { label: 'Smartphones', q: 'smartphone', photo: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=300&q=80',         note: 'Most tracked category this week' },
  { label: 'Laptops',     q: 'laptop', photo: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&h=300&q=80',              note: 'Compare deals across brands' },
  { label: 'Headphones',  q: 'headphones', photo: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&h=300&q=80',          note: 'Wired, wireless & noise-cancelling' },
  { label: 'Gaming',      q: 'gaming console', photo: 'https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&w=400&h=300&q=80',      note: 'Consoles, accessories & bundles' },
  { label: 'Cameras',     q: 'digital camera', photo: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=400&h=300&q=80',      note: 'DSLR, mirrorless & point-and-shoot' },
  { label: 'Tablets',     q: 'tablet', photo: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=400&h=300&q=80',              note: 'For work, school & streaming' },
  { label: 'TVs',         q: '4K TV', photo: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&h=300&q=80',               note: '4K, OLED & smart TVs' },
  { label: 'Smart Home',  q: 'smart home device', photo: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=400&h=300&q=80',   note: 'Speakers, cameras & automation' },
  { label: 'PC Parts',    q: 'graphics card GPU', photo: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=400&h=300&q=80',   note: 'GPUs, CPUs & everything to build a PC' },
];

/* Rotating hero banner slides */
const HERO_SLIDES = [
  {
    eyebrow: 'Best deal online on wearables', title: 'SMART\nWEARABLES.', sub: 'Up to 60% off', q: 'smartwatch', art: 'watch', category: 'Smartphones',
    photo: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on smartphones', title: 'FLAGSHIP\nPHONES.', sub: 'Up to 40% off', q: 'smartphone', art: 'phone', category: 'Smartphones',
    photo: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on audio', title: 'WIRELESS\nAUDIO.', sub: 'Up to 50% off', q: 'headphones', art: 'headphones', category: 'Headphones',
    photo: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on laptops', title: 'POWER\nLAPTOPS.', sub: 'Up to 35% off', q: 'laptop', category: 'Laptops',
    photo: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on gaming gear', title: 'LEVEL UP\nGAMING.', sub: 'Up to 45% off', q: 'gaming console', category: 'Gaming',
    photo: 'https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on cameras', title: 'CAPTURE\nMORE.', sub: 'Up to 30% off', q: 'digital camera', category: 'Cameras',
    photo: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on smart TVs', title: 'BIGGER\nSCREENS.', sub: 'Up to 40% off', q: '4K TV', category: 'TVs',
    photo: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=1400&q=85',
  },
  {
    eyebrow: 'Best deal online on smart home', title: 'SMARTER\nHOME.', sub: 'Up to 50% off', q: 'smart home device', category: 'Smart Home',
    photo: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1400&q=85',
  },
];

/* Shaded product illustrations for the hero banner (not line-art icons) —
   self-contained SVGs so the banner shows an actual device instead of
   depending on an external product photo. */
const HERO_ART = {
  watch: (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      <rect x="55" y="8" width="50" height="20" rx="6" fill="#3a3a3a" />
      <rect x="55" y="132" width="50" height="20" rx="6" fill="#3a3a3a" />
      <rect x="34" y="34" width="92" height="92" rx="26" fill="#1c1c1c" />
      <rect x="42" y="42" width="76" height="76" rx="20" fill="#0a0a0a" />
      <rect x="50" y="50" width="60" height="60" rx="14" fill="url(#watchScreen)" />
      <circle cx="80" cy="80" r="20" fill="none" stroke="#eb6200" strokeWidth="3" strokeDasharray="8 6" />
      <circle cx="80" cy="80" r="4" fill="#eb6200" />
      <defs>
        <linearGradient id="watchScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2a3d" />
          <stop offset="1" stopColor="#151520" />
        </linearGradient>
      </defs>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      <rect x="42" y="10" width="76" height="140" rx="16" fill="#1c1c1c" />
      <rect x="48" y="18" width="64" height="124" rx="10" fill="url(#phoneScreen)" />
      <rect x="70" y="24" width="20" height="5" rx="2.5" fill="#0a0a0a" />
      <circle cx="80" cy="90" r="14" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
      <defs>
        <linearGradient id="phoneScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eb6200" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
    </svg>
  ),
  headphones: (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      <path d="M30 88v-8a50 50 0 0 1 100 0v8" fill="none" stroke="#e5e5e5" strokeWidth="8" strokeLinecap="round" />
      <rect x="16" y="80" width="26" height="48" rx="13" fill="url(#earL)" />
      <rect x="118" y="80" width="26" height="48" rx="13" fill="url(#earR)" />
      <circle cx="29" cy="104" r="6" fill="#eb6200" />
      <circle cx="131" cy="104" r="6" fill="#eb6200" />
      <defs>
        <linearGradient id="earL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2a2a" /><stop offset="1" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="earR" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2a2a" /><stop offset="1" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
    </svg>
  ),
};

/* Curated brand row for "Top electronics brands". Tries the real logo glyph
   from Simple Icons first; if that request ever fails (blocked network,
   ad blocker, offline), BrandTile falls back to a styled text wordmark
   instead of rendering a blank tile. */
// `color`/`bg` style the text-wordmark FALLBACK badge only (shown if the
// logo image fails to load) — the card itself always has a plain white
// background, so `logoColor` is a separate value chosen to actually be
// visible against white, used to recolor the real logo image itself.
const TOP_BRANDS = [
  { name: 'Apple',   slug: 'apple',   bg: '#111111', color: '#ffffff', logoColor: '000000', tag: 'Up to 40% off' },
  { name: 'Samsung', slug: 'samsung', bg: '#eef2ff', color: '#3730a3', logoColor: '1428a0', tag: 'Up to 35% off' },
  { name: 'Sony',    slug: 'sony',    bg: '#0f172a', color: '#ffffff', logoColor: '000000', tag: 'Up to 30% off' },
  { name: 'Xiaomi',  slug: 'xiaomi',  bg: '#fff2e5', color: '#eb6200', logoColor: 'ff6900', tag: 'Up to 50% off' },
];

function BrandTile({ brand, onClick }) {
  /* The logo is an inlined local SVG (see components/BrandLogo). It used to
     be a remote CDN image, which rendered as an empty tile whenever that CDN
     was unreachable. If a slug ever has no bundled glyph, BrandLogo returns
     null and the styled wordmark below takes over. */
  const logo = (
    <BrandLogo slug={brand.slug} title={brand.name} className="h-10 w-10 shrink-0" />
  );
  return (
    <button onClick={onClick} className="w-full card card-hover p-5 flex flex-col items-center gap-3 text-center">
      <span
        className="w-24 h-14 rounded-lg flex items-center justify-center px-3 py-2 font-bold text-lg tracking-tight overflow-hidden"
        style={{ backgroundColor: brand.bg, color: brand.color }}
      >
        {logo || brand.name}
      </span>
      <span className="badge badge-orange text-[11px]">{brand.tag}</span>
    </button>
  );
}

/* Page-number controls for a product grid section. Hidden entirely when
   everything fits on one page. */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="Previous page"
        className="w-8 h-8 rounded-full surface-2 disabled:opacity-40 flex items-center justify-center text-muted hover:text-brand transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-label={`Page ${i + 1}`}
          className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${i === page ? 'bg-brand text-on-brand' : 'surface-2 text-muted hover:text-brand'}`}
        >
          {i + 1}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        aria-label="Next page"
        className="w-8 h-8 rounded-full surface-2 disabled:opacity-40 flex items-center justify-center text-muted hover:text-brand transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  );
}

/* Empty state for a product grid section */
function EmptyGrid({ icon, message, cta }) {
  return (
    <FadeIn className="card p-10 flex flex-col items-center text-center gap-3">
      <span className="w-11 h-11 rounded-xl surface-2 text-faint flex items-center justify-center">
        {icon}
      </span>
      <p className="text-sm text-muted max-w-sm">{message}</p>
      {cta}
    </FadeIn>
  );
}

/* Reusable product card. Shows a top-left "% off" ribbon and a strikethrough
   original price + "Save X" line whenever the product has dropped from its
   all-time high, on top of the caller-supplied badge (tracking count, etc). */
function ProductCard({ product, badge, badgeClass }) {
  const hasDrop = product.highestPrice > product.currentPrice;
  const discountPercent = hasDrop
    ? Math.round(((product.highestPrice - product.currentPrice) / product.highestPrice) * 100)
    : 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group card card-hover p-4 flex flex-col gap-3 hover:border-[var(--brand)]"
    >
      <div className="w-full aspect-square surface-2 group-hover:bg-brand-soft rounded-xl overflow-hidden relative flex items-center justify-center p-4 transition-colors duration-300">
        {discountPercent > 0 && (
          <span className="absolute top-2 left-2 z-10 rounded-md bg-danger text-white text-[10px] font-bold px-1.5 py-1 leading-none">
            {discountPercent}% OFF
          </span>
        )}
        <ProductImage
          src={product.imageUrl}
          alt={product.title}
          productId={product.id}
          className="w-full h-full object-contain group-hover:scale-[1.05] transition-transform duration-300"
          wrapperClass="w-full h-full"
        />
      </div>
      <div>
        <p className="text-xs font-semibold text-app line-clamp-2 leading-snug mb-2 min-h-[2rem]">{product.title}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-lg price-tag">
            <Price amount={product.currentPrice} currency={product.currency} />
          </p>
          {discountPercent > 0 && (
            <span className="text-xs text-faint line-through"><Price amount={product.highestPrice} currency={product.currency} /></span>
          )}
        </div>
        {discountPercent > 0 && (
          <p className="text-[11px] font-semibold" style={{ color: 'var(--success)' }}>
            Save <Price amount={product.highestPrice - product.currentPrice} currency={product.currency} />
          </p>
        )}
        {badge && (
          <span className={`badge mt-1.5 inline-block ${badgeClass}`}>{badge}</span>
        )}
      </div>
    </Link>
  );
}

/* Real product photo for a hero slide, with a graceful fallback to the
   vector illustration (HERO_ART) if the Unsplash image fails to load. The
   left edge fades to transparent via a mask so the banner's dark background
   bleeds into the photo instead of a hard rectangle edge. */
function HeroPhoto({ slide }) {
  const [failed, setFailed] = useState(false);
  const fadeStyle = {
    maskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
    WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
  };
  if (failed) {
    // Slides with dedicated shaded art (HERO_ART) use that; the rest fall
    // back to their category's outline icon, scaled way up, so every slide
    // still shows something device-shaped instead of a blank panel.
    return (
      <div className="w-full h-full flex items-center justify-center text-white/80" style={fadeStyle}>
        <span className="w-24 h-24 [&_svg]:w-full [&_svg]:h-full">
          {HERO_ART[slide.art] || icons[slide.category]}
        </span>
      </div>
    );
  }
  return (
    <img
      src={slide.photo}
      alt={slide.title.replace('\n', ' ')}
      className="w-full h-full object-cover"
      style={fadeStyle}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* Compact rotating banner (auto-advances every 5s), replaces the old full
   split-screen hero: a dark strip with a headline, a "shop now" CTA, and
   prev/next + dot controls, closer to a typical marketplace homepage. */
function HeroCarousel() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const go = (delta) => setIdx(i => (i + delta + HERO_SLIDES.length) % HERO_SLIDES.length);
  const slide = HERO_SLIDES[idx];

  return (
    <div className="relative bg-ink-2 rounded-2xl overflow-hidden px-8 md:px-14 py-7 md:py-10 min-h-[220px] flex items-center">
      {/* Photo fills the whole right side of the banner, full height, with a
          left-edge fade so it bleeds into the dark background instead of
          sitting in a hard-edged box. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={spring}
          /* Visible at every width. It used to be `hidden md:block`, which
             left the banner as a flat colour block on phones and narrow
             windows. On small screens it becomes a dimmed full-bleed
             backdrop behind the copy instead of a side panel, so there's
             still a product image without the headline losing contrast. */
          className="absolute inset-y-0 right-0 w-full opacity-30 md:opacity-100 md:w-[58%] z-0"
        >
          <HeroPhoto slide={slide} />
        </motion.div>
      </AnimatePresence>

      <button
        onClick={() => go(-1)}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>

      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={spring}
            className="max-w-md mx-auto md:mx-0"
          >
            <p className="text-white/70 text-sm mb-2">{slide.eyebrow}</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight whitespace-pre-line mb-3 tracking-tight">
              {slide.title}
            </h2>
            <p className="text-brand font-bold text-lg mb-6">{slide.sub}</p>
            <button
              onClick={() => navigate(`/search?q=${encodeURIComponent(slide.q)}`)}
              className="bg-on-brand text-brand font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Shop now
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        onClick={() => go(1)}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-brand' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* Section wrapper. `icon` is the default header treatment (a small
   brand-soft icon tile beside the heading); `eyebrow` is reserved for the
   one section that deserves a named kicker, not repeated on every section. */
function Section({ eyebrow, icon, title, subtitle, action, children }) {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-8">
      <FadeIn className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h2 className="text-2xl font-bold text-app tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </FadeIn>
      {children}
    </section>
  );
}

/* Main component */
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [topDrops, setTopDrops] = useState([]);
  const [mostWishlisted, setMostWishlisted] = useState([]);
  const [newest, setNewest] = useState([]);
  const [dealOfDay, setDealOfDay] = useState(null);
  const [loadingDrops, setLoadingDrops] = useState(true);
  const [loadingWishlisted, setLoadingWishlisted] = useState(true);
  const [loadingNewest, setLoadingNewest] = useState(true);
  const [loadingDeal, setLoadingDeal] = useState(true);
  const [stats, setStats] = useState(null);
  const PER_PAGE = 4;
  const [wishlistPage, setWishlistPage] = useState(0);
  const [dropsPage, setDropsPage] = useState(0);
  const [newestPage, setNewestPage] = useState(0);

  useEffect(() => {
    api.get('/products/top-drops').then(r => setTopDrops(r.data)).catch(() => {}).finally(() => setLoadingDrops(false));
    api.get('/products/most-wishlisted').then(r => setMostWishlisted(r.data)).catch(() => {}).finally(() => setLoadingWishlisted(false));
    api.get('/products/newest').then(r => setNewest(r.data)).catch(() => {}).finally(() => setLoadingNewest(false));
    api.get('/products/deal-of-day').then(r => setDealOfDay(r.data)).catch(() => {}).finally(() => setLoadingDeal(false));
    api.get('/products/public-stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="bg-app overflow-hidden">
      {/* Top search bar, sits above the carousel */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <form onSubmit={handleSearch} className="relative w-full">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products"
            className="input pl-10 py-2.5 text-sm"
          />
        </form>
      </section>

      {/* Hero: compact rotating deal banner */}
      <section className="max-w-7xl mx-auto px-4 pt-4 pb-6">
        <HeroCarousel />
      </section>

      {/* Categories (square tiles, "Shop from top categories") + top brands
          stacked underneath in the same section, rather than two separate
          full headers back to back. */}
      <section className="max-w-7xl mx-auto px-4 pb-8">
        <FadeIn className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-app tracking-tight">Shop from top categories</h2>
          </div>
        </FadeIn>
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3 mb-8">
          {CATEGORIES.map(cat => (
            <StaggerItem key={cat.label}>
              <button
                onClick={() => navigate(`/search?q=${encodeURIComponent(cat.q)}`)}
                className="card card-hover overflow-hidden w-full text-left group"
              >
                <img src={cat.photo} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover surface-3" />
                <span className="block px-3 py-2.5 text-sm font-semibold text-app">{cat.label}</span>
              </button>
            </StaggerItem>
          ))}
        </Stagger>

        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4" stagger={0.05}>
          {TOP_BRANDS.map(brand => (
            <StaggerItem key={brand.name}>
              <BrandTile brand={brand} onClick={() => navigate(`/search?q=${encodeURIComponent(brand.name)}`)} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Deal of the Day */}
{(loadingDeal || dealOfDay) && (<>
      <section className="max-w-7xl mx-auto px-4 pb-6">
        <FadeIn className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-app tracking-tight">Deal of the day</h2>
          </div>
        </FadeIn>
        {loadingDeal ? (
          <div className="card h-40 animate-pulse surface-2" />
        ) : !dealOfDay ? (
          <EmptyGrid
            icon={<Icon.bolt className="w-5 h-5" />}
            message="No standout deal yet. Deals surface once enough people are tracking a price drop, so check back soon."
            cta={<Link to="/search" className="text-sm text-brand font-semibold">Browse products &rarr;</Link>}
          />
        ) : (
            <FadeIn>
            <Link to={`/product/${dealOfDay.id}`}
              className="card card-hover flex flex-col md:flex-row gap-6 p-6 bg-brand-soft border-app group">
              <div className="w-28 h-28 rounded-2xl surface shadow-[var(--shadow-sm)] flex items-center justify-center p-3 shrink-0 mx-auto md:mx-0">
                <ProductImage
                  src={dealOfDay.imageUrl}
                  alt={dealOfDay.title}
                  productId={dealOfDay.id}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                  fallbackClass="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0 text-center md:text-left">
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-2">
                  <span className="badge bg-brand text-on-brand">Deal of the Day</span>
                  <DealScore
                    currentPrice={dealOfDay.currentPrice}
                    lowestPrice={dealOfDay.lowestPrice}
                    highestPrice={dealOfDay.highestPrice}
                    size="sm"
                  />
                </div>
                <h3 className="font-bold text-app text-lg mb-1 line-clamp-2">{dealOfDay.title}</h3>
                <div className="flex items-baseline gap-3 justify-center md:justify-start">
                  <span className="text-3xl price-tag"><Price amount={dealOfDay.currentPrice} currency={dealOfDay.currency} /></span>
                  <span className="text-sm text-faint line-through"><Price amount={dealOfDay.highestPrice} currency={dealOfDay.currency} /></span>
                  <span className="badge badge-green">{dealOfDay.dropPercent}% off</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted justify-center md:justify-start">
                  <span className="flex items-center gap-1"><Icon.users className="w-3.5 h-3.5" />{dealOfDay.wishlistCount} tracking this</span>
                  <span>Lowest ever: <strong className="text-success"><Price amount={dealOfDay.lowestPrice} currency={dealOfDay.currency} /></strong></span>
                </div>
              </div>
              <div className="shrink-0 flex items-center justify-center">
                <span className="btn-primary text-sm px-6 py-3">View Deal</span>
              </div>
            </Link>
            </FadeIn>
        )}
      </section>
</>)}

      {/* Most wishlisted */}
{(loadingWishlisted || mostWishlisted.length > 0) && (<>
      <div className="surface border-y border-app pt-8">
        <Section
          icon={<Icon.users className="w-4 h-4" />}
          title="Most wishlisted"
          action={
            <Link to="/trends" className="text-sm text-brand hover:text-[var(--brand-strong)] font-semibold flex items-center gap-1">
              Trends <span>&rarr;</span>
            </Link>
          }
        >
          {loadingWishlisted ? (
            <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
            </Stagger>
          ) : mostWishlisted.length === 0 ? (
            <EmptyGrid
              icon={<Icon.users className="w-5 h-5" />}
              message="No one's tracking a product yet. Be the first to add something to your wishlist."
              cta={<Link to="/search" className="text-sm text-brand font-semibold">Find something to track &rarr;</Link>}
            />
          ) : (
            <>
              <Stagger key={wishlistPage} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {mostWishlisted.slice(wishlistPage * PER_PAGE, wishlistPage * PER_PAGE + PER_PAGE).map((product, i) => {
                  const idx = wishlistPage * PER_PAGE + i;
                  return (
                    <StaggerItem key={product.id} className="relative">
                      {idx < 3 && (
                        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-brand shadow-[var(--shadow-sm)] flex items-center justify-center text-on-brand text-[10px] font-bold">
                          #{idx + 1}
                        </div>
                      )}
                      <ProductCard product={product} badge={`${product.wishlistCount} tracking`} badgeClass="badge-purple" />
                    </StaggerItem>
                  );
                })}
              </Stagger>
              <Pagination
                page={wishlistPage}
                totalPages={Math.ceil(mostWishlisted.length / PER_PAGE)}
                onChange={setWishlistPage}
              />
            </>
          )}
        </Section>
      </div>
</>)}

      {/* Top Price Drops */}
{(loadingDrops || topDrops.length > 0) && (<>
      <Section
        icon={<Icon.chart className="w-4 h-4" />}
        title="Top price drops"
        action={
          <Link to="/search" className="text-sm text-brand hover:text-[var(--brand-strong)] font-semibold flex items-center gap-1">
            View all <span>&rarr;</span>
          </Link>
        }
      >
        {loadingDrops ? (
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
          </Stagger>
        ) : topDrops.length === 0 ? (
          <EmptyGrid
            icon={<Icon.chart className="w-5 h-5" />}
            message="No price drops recorded yet. Drops show up here once tracked products have enough price history."
            cta={<Link to="/search" className="text-sm text-brand font-semibold">Search products &rarr;</Link>}
          />
        ) : (
          <>
            <Stagger key={dropsPage} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {topDrops.slice(dropsPage * PER_PAGE, dropsPage * PER_PAGE + PER_PAGE).map(product => (
                <StaggerItem key={product.id}>
                  <ProductCard product={product} badge={`${product.dropPercent}% off peak`} badgeClass="badge-red" />
                </StaggerItem>
              ))}
            </Stagger>
            <Pagination page={dropsPage} totalPages={Math.ceil(topDrops.length / PER_PAGE)} onChange={setDropsPage} />
          </>
        )}
      </Section>
</>)}

      {/* Newest Added */}
{(loadingNewest || newest.length > 0) && (<>
      <Section icon={<Icon.bell className="w-4 h-4" />} title="Newly tracked">
        {loadingNewest ? (
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
          </Stagger>
        ) : newest.length === 0 ? (
          <EmptyGrid
            icon={<Icon.bell className="w-5 h-5" />}
            message="Nothing tracked yet. Search for a product and add it to your wishlist to see it here."
            cta={<Link to="/search" className="text-sm text-brand font-semibold">Search products &rarr;</Link>}
          />
        ) : (
          <>
            <Stagger key={newestPage} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {newest.slice(newestPage * PER_PAGE, newestPage * PER_PAGE + PER_PAGE).map(product => (
                <StaggerItem key={product.id}>
                  <ProductCard product={product} badge="New" badgeClass="badge-blue" />
                </StaggerItem>
              ))}
            </Stagger>
            <Pagination page={newestPage} totalPages={Math.ceil(newest.length / PER_PAGE)} onChange={setNewestPage} />
          </>
        )}
      </Section>
</>)}

      {/* Nothing tracked yet: one short note instead of four empty boxes. */}
      {!loadingDeal && !loadingWishlisted && !loadingDrops && !loadingNewest
        && !dealOfDay && !mostWishlisted.length && !topDrops.length && !newest.length && (
        <section className="max-w-7xl mx-auto px-4 pb-8">
          <p className="card p-6 text-sm text-muted">
            Nobody is tracking anything yet, so there are no deals to show.{' '}
            <Link to="/search" className="text-brand font-semibold">Search for a product</Link> and add it to your wishlist to start.
          </p>
        </section>
      )}

      {/* How it works: plain facts about what the app actually does. */}
      <section className="surface border-y border-app py-10 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-[1fr_1.4fr] gap-8">
          <div>
            <h2 className="text-2xl font-bold text-app tracking-tight">How it works</h2>
            <p className="text-sm text-muted mt-2 max-w-sm">
              PricePulse looks up prices on Google Shopping, saves every price it sees,
              and emails you when a product reaches the price you picked.
            </p>
            {!user && (
              <Link to="/register" className="btn-primary inline-block mt-5">Create a free account</Link>
            )}
          </div>
          <ol className="grid sm:grid-cols-3 gap-6 text-sm">
            <li>
              <p className="font-data text-xs text-faint">1</p>
              <h3 className="font-semibold text-app mt-1">Search</h3>
              <p className="text-muted mt-1">Pick a country and search. Prices come back in that country's currency.</p>
            </li>
            <li>
              <p className="font-data text-xs text-faint">2</p>
              <h3 className="font-semibold text-app mt-1">Set a target</h3>
              <p className="text-muted mt-1">Add the product to your wishlist with a target price or a percentage drop.</p>
            </li>
            <li>
              <p className="font-data text-xs text-faint">3</p>
              <h3 className="font-semibold text-app mt-1">Get an email</h3>
              <p className="text-muted mt-1">Prices are re-checked every 3 to 48 hours. When yours is hit, you get an email and an in-app alert.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Stats strip: real aggregate counts from /products/public-stats */}
      {stats && stats.productsTracked > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              [stats.productsTracked, 'products tracked'],
              [stats.activeTrackers, 'people tracking prices'],
              [stats.priceChecks, 'prices recorded'],
              [stats.dropsRecorded, 'products below their peak'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-2xl font-bold font-data text-app">{value?.toLocaleString?.() ?? value}</p>
                <p className="text-xs text-muted mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
