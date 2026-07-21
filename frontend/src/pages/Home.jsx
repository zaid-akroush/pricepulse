import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { ProductCardSkeleton } from '../components/Skeleton';
import ProductImage from '../components/ProductImage';
import DealScore from '../components/DealScore';
import { FadeIn, Stagger, StaggerItem, spring } from '../components/motion';

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

/* Category icons */
const icons = {
  Smartphones: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="10" y="4" width="20" height="32" rx="4" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <circle cx="20" cy="31" r="1.5" fill="currentColor"/>
      <rect x="15" y="8" width="10" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  ),
  Laptops: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="6" y="9" width="28" height="18" rx="2.5" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <path d="M2 28h36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <rect x="13" y="28" width="14" height="2.5" rx="1.25" fill="currentColor"/>
    </svg>
  ),
  Headphones: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <path d="M8 22v-4a12 12 0 0 1 24 0v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <rect x="4" y="22" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <rect x="30" y="22" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="2.2" fill="none"/>
    </svg>
  ),
  Gaming: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="4" y="13" width="32" height="18" rx="6" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <path d="M13 19v6M10 22h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="27" cy="20" r="1.5" fill="currentColor"/>
      <circle cx="30" cy="23" r="1.5" fill="currentColor"/>
    </svg>
  ),
  Cameras: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="5" y="12" width="30" height="20" rx="4" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <path d="M15 12l2-4h6l2 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="20" cy="22" r="6" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <circle cx="20" cy="22" r="2" fill="currentColor"/>
    </svg>
  ),
  Tablets: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="7" y="4" width="26" height="32" rx="4" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <circle cx="20" cy="31.5" r="1.5" fill="currentColor"/>
      <rect x="14" y="8" width="12" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  ),
  TVs: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <rect x="3" y="7" width="34" height="22" rx="3" stroke="currentColor" strokeWidth="2.2" fill="none"/>
      <path d="M14 29v4M26 29v4M10 33h20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <rect x="8" y="11" width="24" height="14" rx="1.5" fill="currentColor" opacity="0.15"/>
    </svg>
  ),
  'Smart Home': (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <path d="M5 18L20 6l15 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 16v16h22V16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="16" y="24" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  ),
};

const CATEGORIES = [
  { label: 'Smartphones', q: 'smartphone' },
  { label: 'Laptops',     q: 'laptop' },
  { label: 'Headphones',  q: 'headphones' },
  { label: 'Gaming',      q: 'gaming console' },
  { label: 'Cameras',     q: 'digital camera' },
  { label: 'Tablets',     q: 'tablet' },
  { label: 'TVs',         q: '4K TV' },
  { label: 'Smart Home',  q: 'smart home device' },
];

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

/* Reusable product card */
function ProductCard({ product, badge, badgeClass }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group card card-hover p-4 flex flex-col gap-3 hover:border-[var(--brand)]"
    >
      <div className="w-full aspect-square surface-2 group-hover:bg-brand-soft rounded-xl overflow-hidden relative flex items-center justify-center p-4 transition-colors duration-300">
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
        <p className="text-lg price-tag">
          {product.currency} {product.currentPrice.toFixed(2)}
        </p>
        {badge && (
          <span className={`badge mt-1.5 inline-block ${badgeClass}`}>{badge}</span>
        )}
      </div>
    </Link>
  );
}

/* Section wrapper. `icon` is the default header treatment (a small
   brand-soft icon tile beside the heading); `eyebrow` is reserved for the
   one section that deserves a named kicker, not repeated on every section. */
function Section({ eyebrow, icon, title, subtitle, action, children }) {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-14">
      <FadeIn className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
              {icon}
            </span>
          )}
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

/* Hero preview panel: a small illustrated "live tracking" card cluster,
   built from real UI primitives instead of a stock photo. */
function HeroPreview() {
  const points = [64, 58, 61, 46, 50, 34, 26];
  const w = 220, h = 70;
  const step = w / (points.length - 1);
  const max = Math.max(...points), min = Math.min(...points);
  const norm = (v) => h - ((v - min) / (max - min || 1)) * h;
  const poly = points.map((p, i) => `${i * step},${norm(p)}`).join(' ');

  return (
    <div className="relative h-full w-full flex items-center justify-center py-10 lg:py-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotate: -3 }}
        animate={{ opacity: 1, scale: 1, rotate: -3 }}
        transition={{ ...spring, delay: 0.15 }}
        className="animate-float card p-6 w-72 shrink-0"
        style={{ transform: 'rotate(-3deg)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl surface-2 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 40 40" className="w-6 h-6 text-brand" fill="none">
              <rect x="10" y="4" width="20" height="32" rx="4" stroke="currentColor" strokeWidth="2.2"/>
              <circle cx="20" cy="31" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-app leading-tight">Flagship Phone 128GB</p>
            <p className="text-[11px] text-faint">Tracked 42 days</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold price-tag">$799</span>
          <span className="text-xs text-faint line-through">$999</span>
          <span className="badge badge-green ml-auto">-20%</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
          <polyline points={poly} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -12, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ ...spring, delay: 0.4 }}
        className="absolute top-4 left-2 lg:left-0 card px-4 py-2.5 flex items-center gap-2 shadow-float"
      >
        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-semibold text-app whitespace-nowrap">Target price hit</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.7 }}
        className="absolute top-6 right-2 lg:-top-1 lg:right-2 card px-3.5 py-2.5 flex items-center gap-3 shadow-float"
      >
        <span className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0">
          <Icon.chart className="w-4 h-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-app font-data">$142</p>
          <p className="text-[10px] text-faint whitespace-nowrap">avg. saved per item</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 12, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ ...spring, delay: 0.55 }}
        className="absolute bottom-6 right-0 lg:right-2 card px-3.5 py-2.5 flex items-center gap-2 shadow-float"
      >
        <span className="w-7 h-7 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
          <Icon.bell className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-semibold text-app whitespace-nowrap">Alert emailed</span>
      </motion.div>
    </div>
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
      {/* Hero: asymmetric split-screen, left-aligned copy */}
      <section className="relative pt-16 pb-16 md:pb-24 px-4 border-b border-app">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="relative z-10 text-left"
          >
            <div className="inline-flex items-center gap-2 bg-brand-soft text-brand text-xs font-semibold px-4 py-1.5 rounded-full mb-7 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" /> Real-time price tracking
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-[1.05] tracking-tight text-app">
              Never overpay<br />
              <span className="text-brand">for electronics</span>
            </h1>
            <p className="text-muted text-lg mb-9 max-w-lg leading-relaxed">
              Track prices across major retailers. Set your target, and we'll email you the moment prices drop.
            </p>

            <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder='Search "iPhone 16", "Sony WH-1000XM5"'
                  className="input pl-10 py-3.5"
                />
              </div>
              <button type="submit" className="btn-primary px-7 py-3.5 whitespace-nowrap">
                Search
              </button>
            </form>

            {/* quick stats */}
            <div className="flex items-center gap-7 mt-9 text-xs text-muted flex-wrap">
              {[[Icon.bell, 'Price alerts'], [Icon.chart, 'Price history'], [Icon.globe, 'All major retailers']].map(([IconCmp, label]) => (
                <span key={label} className="flex items-center gap-1.5"><IconCmp className="w-3.5 h-3.5" />{label}</span>
              ))}
            </div>
          </motion.div>

          <HeroPreview />
        </div>
      </section>

      {/* Categories: asymmetric bento with one featured tile */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <FadeIn className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-app tracking-tight">Browse by category</h2>
            <p className="text-sm text-muted mt-0.5">Jump straight into what you're looking for</p>
          </div>
        </FadeIn>
        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3 [grid-auto-rows:1fr]" stagger={0.05}>
          {CATEGORIES.map((cat, i) => (
            <StaggerItem key={cat.label} className={i === 0 ? 'md:row-span-2 md:col-span-1' : ''}>
              <button
                onClick={() => navigate(`/search?q=${encodeURIComponent(cat.q)}`)}
                className={`spotlight w-full h-full flex flex-col items-start gap-3 rounded-2xl card card-hover text-left group ${i === 0 ? 'p-5 justify-between' : 'p-4'}`}
              >
                <div className={`shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center group-hover:scale-105 transition-transform ${i === 0 ? 'w-14 h-14' : 'w-12 h-12'}`}>
                  {icons[cat.label]}
                </div>
                <span className={`font-semibold text-app group-hover:text-brand transition-colors leading-tight flex items-center gap-1 ${i === 0 ? 'text-base' : 'text-sm'}`}>
                  {cat.label}
                  <svg className="w-3.5 h-3.5 text-faint group-hover:text-brand group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </span>
                {i === 0 && <span className="text-xs text-muted">Most tracked category this week</span>}
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Deal of the Day */}
      <section className="max-w-7xl mx-auto px-4 pb-10">
        <FadeIn className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
            <Icon.bolt className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-app tracking-tight">Deal of the day</h2>
            <p className="text-sm text-muted">Today's top-rated deal by our community</p>
          </div>
        </FadeIn>
        {loadingDeal ? (
          <div className="card h-40 animate-pulse surface-2" />
        ) : !dealOfDay ? (
          <EmptyGrid
            icon={<Icon.bolt className="w-5 h-5" />}
            message="No standout deal yet — deals surface once enough people are tracking a price drop. Check back soon."
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
                  <span className="text-3xl price-tag">{dealOfDay.currency} {dealOfDay.currentPrice.toFixed(2)}</span>
                  <span className="text-sm text-faint line-through">{dealOfDay.currency} {dealOfDay.highestPrice.toFixed(2)}</span>
                  <span className="badge badge-green">{dealOfDay.dropPercent}% off</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted justify-center md:justify-start">
                  <span className="flex items-center gap-1"><Icon.users className="w-3.5 h-3.5" />{dealOfDay.wishlistCount} tracking this</span>
                  <span className="flex items-center gap-1"><Icon.heart className="w-3.5 h-3.5" />{dealOfDay.likeCount} likes</span>
                  <span>Lowest ever: <strong className="text-success">{dealOfDay.currency} {dealOfDay.lowestPrice.toFixed(2)}</strong></span>
                </div>
              </div>
              <div className="shrink-0 flex items-center justify-center">
                <span className="btn-primary text-sm px-6 py-3">View Deal</span>
              </div>
            </Link>
            </FadeIn>
        )}
      </section>

      {/* Most Wishlisted — set on a raised `surface` band (same technique as
          "How it works" below) so this doesn't read as a third identical
          section stacked on the same paper background as the two after it. */}
      <div className="surface border-y border-app pt-14">
        <Section
          icon={<Icon.users className="w-4 h-4" />}
          title="Most wishlisted"
          subtitle="Products most users are tracking right now"
          action={
            <Link to="/community" className="text-sm text-brand hover:text-[var(--brand-strong)] font-semibold flex items-center gap-1">
              Community <span>&rarr;</span>
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
            <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {mostWishlisted.slice(0, 4).map((product, idx) => (
                <StaggerItem key={product.id} className="relative">
                  {idx < 3 && (
                    <div className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-brand shadow-[var(--shadow-sm)] flex items-center justify-center text-on-brand text-[10px] font-bold">
                      #{idx + 1}
                    </div>
                  )}
                  <ProductCard product={product} badge={`${product.wishlistCount} tracking`} badgeClass="badge-purple" />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </Section>
      </div>

      {/* Top Price Drops */}
      <Section
        icon={<Icon.chart className="w-4 h-4" />}
        title="Top price drops"
        subtitle="Biggest drops on products being tracked"
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
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {topDrops.slice(0, 4).map(product => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} badge={`${product.dropPercent}% off peak`} badgeClass="badge-red" />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      {/* Newest Added */}
      <Section icon={<Icon.bell className="w-4 h-4" />} title="Newly tracked" subtitle="Latest products people just started following">
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
          <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {newest.slice(0, 4).map(product => (
              <StaggerItem key={product.id}>
                <ProductCard product={product} badge="New" badgeClass="badge-blue" />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      {/* Capabilities: a wide illustrated banner (forecast) stacked over a
          two-up duo (compare / share) — distinct from both the bento grid
          above and the connected timeline below. Each mini panel is a hand-
          built static illustration of the real component it represents
          (PricePrediction.jsx, PriceCompare.jsx, the /shared/:token wishlist
          link), not a stock graphic. */}
      <section className="max-w-7xl mx-auto px-4 pb-14">
        <FadeIn className="mb-6">
          <h2 className="text-2xl font-bold text-app tracking-tight">More than a price tag</h2>
          <p className="text-sm text-muted mt-0.5">Three tools that go beyond basic tracking</p>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Forecast — wide banner, spans full width */}
          <FadeIn className="lg:col-span-5 spotlight card card-hover p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center mb-4">
                <Icon.target className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-bold text-app mb-2">Buy now, or wait?</h3>
              <p className="text-sm text-muted leading-relaxed max-w-md">
                Every tracked product gets a price forecast — 7 and 30 days out, built from its
                own history — with a plain-language recommendation and a confidence score, so
                you're not guessing whether a "deal" is really the bottom.
              </p>
            </div>
            {/* mini illustration of PricePrediction's recommendation + meter */}
            <div className="w-full md:w-80 shrink-0 rounded-2xl border border-app p-4 surface-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-app">Price Forecast</span>
                <span className="badge badge-neutral text-[10px]">82% confidence</span>
              </div>
              <div className="rounded-xl border p-3 flex items-start gap-2.5 mb-3" style={{ borderColor: 'var(--success)', backgroundColor: 'var(--success-soft)' }}>
                <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: 'var(--success)' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>Buy now</p>
                  <p className="text-[11px] text-muted mt-0.5">Trending up over the next 30 days</p>
                </div>
              </div>
              <div className="h-2 rounded-full relative" style={{ backgroundImage: 'linear-gradient(to right, var(--success), var(--warning), var(--danger))' }}>
                <div className="absolute -top-1 w-3.5 h-3.5 rounded-full border-2" style={{ left: 'calc(22% - 7px)', backgroundColor: 'var(--surface)', borderColor: 'var(--ink)' }} />
              </div>
              <div className="flex justify-between text-[10px] text-faint mt-1.5">
                <span>Lowest ever</span><span>Highest ever</span>
              </div>
            </div>
          </FadeIn>

          {/* Compare — narrower duo panel */}
          <FadeIn delay={0.08} className="lg:col-span-2 card card-hover p-6 flex flex-col">
            <span className="w-10 h-10 rounded-xl bg-info-soft text-info flex items-center justify-center mb-4">
              <Icon.scale className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-app mb-2">One product, every price</h3>
            <p className="text-sm text-muted leading-relaxed mb-4">
              We check other retailers selling the same item and line the prices up next to the
              one you're tracking, so you know if it's cheaper elsewhere before you buy.
            </p>
            <div className="mt-auto flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border" style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-soft)' }}>
                <span className="text-[11px] font-bold" style={{ color: 'var(--brand-strong)' }}>Tracked · Amazon</span>
                <span className="text-xs font-bold font-data text-app">$799.00</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg surface-2">
                <span className="text-[11px] text-muted">BestBuy</span>
                <span className="text-xs font-bold font-data" style={{ color: 'var(--success)' }}>$749.00</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg surface-2">
                <span className="text-[11px] text-muted">Walmart</span>
                <span className="text-xs font-bold font-data text-app">$812.50</span>
              </div>
            </div>
          </FadeIn>

          {/* Shareable wishlists — narrower duo panel */}
          <FadeIn delay={0.16} className="lg:col-span-3 card card-hover p-6 flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-purple-soft text-purple flex items-center justify-center mb-4">
                <Icon.link className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-bold text-app mb-2">Share your wishlist</h3>
              <p className="text-sm text-muted leading-relaxed">
                Turn your wishlist into a public, read-only link — for a gift registry, a group
                chat, or just showing off what you're tracking. No account needed to view it.
              </p>
            </div>
            <div className="w-full md:w-56 shrink-0 rounded-2xl border border-app p-4 surface-2">
              <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg surface border border-app">
                <Icon.link className="w-3.5 h-3.5 text-faint shrink-0" />
                <span className="text-[11px] text-muted truncate font-data">pricepulse.app/shared/a3f9…</span>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex-1 aspect-square rounded-lg surface border border-app flex items-center justify-center">
                    <span className="w-4 h-4 rounded-sm bg-brand-soft" />
                  </div>
                ))}
              </div>
              <span className="badge badge-purple mt-3 inline-flex">Public link</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats strip: real aggregate counts from /products/public-stats, not fabricated */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 pb-4">
          <FadeIn className="card p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            {[
              [stats.productsTracked, 'products tracked'],
              [stats.activeTrackers, 'people tracking prices'],
              [stats.priceChecks, 'price checks logged'],
              [stats.dropsRecorded, 'active price drops right now'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-3xl font-bold font-data text-app">{value?.toLocaleString?.() ?? value}</p>
                <p className="text-xs text-muted mt-1">{label}</p>
              </div>
            ))}
          </FadeIn>
        </section>
      )}

      {/* How it works: asymmetric connected timeline, not a centered 3-card row */}
      <section className="surface border-y border-app py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="max-w-md mb-16">
            <p className="eyebrow mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-app tracking-tight">Three steps to smarter shopping</h2>
          </FadeIn>
          <div className="relative">
            <div className="hidden md:block absolute left-[27px] top-2 bottom-2 w-px bg-app border-app border-l border-dashed" />
            <Stagger className="flex flex-col gap-12" stagger={0.12}>
              {[
                {
                  step: '01',
                  title: 'Search Any Product',
                  desc: 'Search millions of electronics from major retailers, powered by real-time Google Shopping data.',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  ),
                },
                {
                  step: '02',
                  title: 'Set Your Target Price',
                  desc: "Add items to your wishlist and enter the price you want to pay. We'll do the watching.",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                    </svg>
                  ),
                },
                {
                  step: '03',
                  title: 'Get Notified Instantly',
                  desc: 'We check prices every 6 hours and email you the moment your target price is reached.',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                  ),
                },
              ].map(f => (
                <StaggerItem key={f.step} className="relative flex items-start gap-6 md:gap-8 pl-0 md:pl-0">
                  <div className="relative z-10 w-14 h-14 shrink-0 rounded-2xl bg-brand text-on-brand flex items-center justify-center shadow-[var(--shadow-brand)]">
                    {f.icon}
                  </div>
                  <div className="pt-1 max-w-md">
                    <span className="text-xs font-bold text-faint tracking-widest font-data">{f.step}</span>
                    <h3 className="font-bold text-app mb-2 text-xl mt-1">{f.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* CTA: asymmetric, not purely centered */}
      {!user && (
        <section className="max-w-7xl mx-auto px-4 py-4">
          <FadeIn className="bg-brand text-on-brand rounded-[2rem] px-8 py-14 md:px-14 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl font-bold mb-3 tracking-tight">Ready to save money?</h2>
              <p className="text-lg max-w-md opacity-90">Join smart shoppers already tracking prices with PricePulse.</p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center shrink-0">
              <Link to="/register" className="bg-[var(--on-brand)] text-brand-strong font-bold px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]">
                Create Free Account
              </Link>
              <Link to="/search" className="border border-current/30 font-semibold px-8 py-3.5 rounded-xl hover:bg-black/10 transition-colors active:scale-[0.98]">
                Browse Products
              </Link>
            </div>
          </FadeIn>
        </section>
      )}
    </div>
  );
}
