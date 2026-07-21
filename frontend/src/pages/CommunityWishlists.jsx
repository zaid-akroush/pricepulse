import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { CommunityRowSkeleton } from '../components/Skeleton';
import ProductImage from '../components/ProductImage';

/* ── Tab ────────────────────────────────────────────────────────────── */
function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`chip !rounded-xl px-5 py-2.5 ${active ? 'chip-active' : ''}`}
    >
      {label}
    </button>
  );
}

/* ── Medal ──────────────────────────────────────────────────────────── */
/* Fixed (non-theme-flipping) fills for avatar/medal identity chips: these
   are decorative user-identity colors, not brand surfaces, so they stay
   constant across light/dark rather than using the semantic tokens (which
   intentionally get lighter in dark mode for text-on-dark-bg contrast, not
   for holding white text as a fill). */
const IDENTITY_COLORS = ['#c04909', '#8156c0', '#0f74c5', '#006d21', '#996700'];

function Medal({ rank }) {
  const medals = { 1: { bg: '#996700', text: '1' }, 2: { bg: '#78716c', text: '2' }, 3: { bg: '#c04909', text: '3' } };
  const m = medals[rank];
  if (m) return <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: m.bg }}>{m.text}</div>;
  return <div className="w-8 h-8 rounded-full surface-3 flex items-center justify-center text-xs font-bold text-faint">{rank}</div>;
}

/* ── Avatar ─────────────────────────────────────────────────────────── */
function Avatar({ name, size = 'md', index = 0 }) {
  const cls = size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  const color = IDENTITY_COLORS[index % IDENTITY_COLORS.length];
  return (
    <div className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0`} style={{ backgroundColor: color }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Sidebar stat card ──────────────────────────────────────────────── */
function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-bold font-data text-brand">{value}</p>
      <p className="text-xs font-bold text-app mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-faint mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Follow Button ───────────────────────────────────────────────────── */
function FollowButton({ userId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || user.id === userId) return;
    api.get(`/social/is-following/${userId}`)
      .then(r => { setFollowing(r.data.following); setChecked(true); })
      .catch(() => setChecked(true));
  }, [user, userId]);

  if (!user || user.id === userId || !checked) return null;

  async function toggle(e) {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    try {
      if (following) {
        await api.delete(`/social/follow/${userId}`);
        setFollowing(false);
      } else {
        await api.post(`/social/follow/${userId}`);
        setFollowing(true);
      }
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all shrink-0 ${
        following
          ? 'surface-3 text-muted border-app hover:bg-danger-soft hover:text-danger hover:border-danger'
          : 'bg-brand text-on-brand border-brand hover:opacity-90'
      }`}
    >
      {loading ? '…' : following ? 'Following ✓' : '+ Follow'}
    </button>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
export default function CommunityWishlists() {
  const [tab, setTab] = useState('wishlists');
  const [wishlists, setWishlists] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bestValue, setBestValue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/community/wishlists'),
      api.get('/community/leaderboard'),
      api.get('/products/best-value'),
    ])
      .then(([w, l, b]) => { setWishlists(w.data); setLeaderboard(l.data); setBestValue(b.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Computed sidebar stats
  const totalItems = wishlists.reduce((s, u) => s + u.itemCount, 0);
  const totalValue = wishlists.reduce((s, u) => s + u.totalValue, 0);
  const topSaver = bestValue[0];

  return (
    <div className="bg-app min-h-screen">
      {/* Page header */}
      <div className="surface border-b border-app">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="eyebrow mb-2">Social</p>
          <h1 className="text-3xl font-bold text-app tracking-tight">Community</h1>
          <p className="text-muted mt-1">Explore wishlists, find the best deals, and see who's tracking what.</p>
          <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
            <Tab active={tab === 'wishlists'}   onClick={() => setTab('wishlists')}   label="Community Wishlists" />
            <Tab active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} label="Most Expensive Wishlists" />
            <Tab active={tab === 'bestvalue'}   onClick={() => setTab('bestvalue')}   label="Best Value Items" />
          </div>
        </div>
      </div>

      {/* Layout: main content + sidebar */}
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6 items-start">

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* ── Community Wishlists ─────────────────────────────────── */}
          {tab === 'wishlists' && (
            <div className="space-y-3">
              {loading
                ? Array(4).fill(0).map((_, i) => <CommunityRowSkeleton key={i} />)
                : wishlists.length === 0
                  ? (
                    <div className="card p-12 text-center">
                      <p className="text-faint font-medium mb-4">No wishlists to show yet.</p>
                      <Link to="/search" className="btn-primary">Search Products</Link>
                    </div>
                  )
                  : wishlists.map((user, idx) => (
                    <div key={user.userId} className="card overflow-hidden">
                      <button
                        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-left"
                        onClick={() => setExpanded(expanded === user.userId ? null : user.userId)}
                      >
                        <Avatar name={user.name} size="lg" index={idx} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-app">{user.name}</p>
                          <p className="text-xs text-faint mt-0.5">{user.itemCount} item{user.itemCount !== 1 ? 's' : ''} tracked</p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-xs text-faint mb-0.5">Total value</p>
                          <p className="font-bold price-tag">${user.totalValue.toFixed(2)}</p>
                        </div>
                        <FollowButton userId={user.userId} />
                        <svg className={`w-4 h-4 text-faint shrink-0 transition-transform ${expanded === user.userId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </button>

                      {expanded === user.userId && (
                        <div className="border-t border-app divide-y divide-app">
                          {user.items.map(item => (
                            <Link key={item.id} to={`/product/${item.product.id}`}
                              className="flex items-center gap-3 px-5 py-3 hover:bg-brand-soft transition-colors">
                              <div className="w-12 h-12 surface-2 rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-1">
                                <ProductImage src={item.product.imageUrl} alt={item.product.title} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-app line-clamp-1">{item.product.title}</p>
                                <p className="text-xs text-faint mt-0.5">{item.product.currency} {item.product.currentPrice.toFixed(2)}</p>
                              </div>
                              {item.product.highestPrice > item.product.currentPrice && (
                                <span className="badge badge-green shrink-0">
                                  {Math.round(((item.product.highestPrice - item.product.currentPrice) / item.product.highestPrice) * 100)}% off
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── Leaderboard ─────────────────────────────────────────── */}
          {tab === 'leaderboard' && (
            <div>
              <p className="text-sm text-muted mb-5">Users ranked by the total value of all wishlisted products.</p>
              {loading
                ? Array(5).fill(0).map((_, i) => <CommunityRowSkeleton key={i} />)
                : leaderboard.length === 0
                  ? (
                    <div className="card p-12 text-center">
                      <p className="text-faint font-medium mb-4">No one's ranked yet — the leaderboard fills up as people track products. Start tracking to see where you stand.</p>
                      <Link to="/search" className="btn-primary">Search Products</Link>
                    </div>
                  )
                  : (
                    <div className="space-y-3">
                      {leaderboard.map((entry, idx) => (
                        <div key={entry.userId}
                          className={`card p-4 flex items-center gap-4 ${idx === 0 ? 'border-warning bg-warning-soft' : idx === 1 ? 'border-app-strong' : idx === 2 ? 'border-brand' : ''}`}>
                          <Medal rank={idx + 1} />
                          <Avatar name={entry.name} index={idx} />
                          <div className="flex-1">
                            <p className="font-bold text-app">{entry.name}</p>
                            <p className="text-xs text-faint">{entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold price-tag">{entry.currency} {entry.totalValue.toFixed(2)}</p>
                            <p className="text-[10px] text-faint uppercase tracking-wide">total value</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              }
            </div>
          )}

          {/* ── Best Value ──────────────────────────────────────────── */}
          {tab === 'bestvalue' && (
            <div>
              <p className="text-sm text-muted mb-5">Tracked products with the highest discount from their all-time peak price.</p>
              {loading
                ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array(4).fill(0).map((_, i) => <CommunityRowSkeleton key={i} />)}</div>
                : bestValue.length === 0
                  ? (
                    <div className="card p-12 text-center">
                      <p className="text-faint font-medium mb-4">No discounted products tracked yet. Once a tracked product drops from its peak price, it'll show up here.</p>
                      <Link to="/search" className="btn-primary">Search Products</Link>
                    </div>
                  )
                  : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bestValue.map(product => (
                        <Link key={product.id} to={`/product/${product.id}`}
                          className="card card-hover p-4 flex gap-3">
                          <div className="w-16 h-16 rounded-xl surface-2 shrink-0 overflow-hidden flex items-center justify-center p-1">
                            <ProductImage src={product.imageUrl} alt={product.title} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-app line-clamp-2 leading-snug mb-1.5">{product.title}</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-base font-bold price-tag">{product.currency} {product.currentPrice.toFixed(2)}</p>
                              <span className="text-xs text-faint line-through">{product.currency} {product.highestPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <span className="badge badge-green">{product.discountPercent}% off peak</span>
                              <span className="badge badge-blue">Save {product.currency} {product.savedAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
              }
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
          {/* Stats */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-4">Community Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Members" value={loading ? '-' : wishlists.length} sub="tracking prices" />
              <StatCard label="Products" value={loading ? '-' : totalItems} sub="wishlisted" />
            </div>
            <div className="mt-3">
              <StatCard
                label="Community Wishlist Value"
                value={loading ? '-' : `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub="combined tracked products"
              />
            </div>
          </div>

          {/* Top Deal */}
          {!loading && topSaver && (
            <div className="bg-brand rounded-2xl p-5 text-on-brand shadow-[var(--shadow-brand)]">
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-3">Biggest Deal Right Now</p>
              <div className="bg-black/10 rounded-xl p-3 mb-3 flex gap-3 items-center">
                <div className="w-16 h-16 rounded-lg bg-black/10 shrink-0 overflow-hidden flex items-center justify-center">
                  <ProductImage
                    src={topSaver.imageUrl}
                    alt={topSaver.title}
                    className="w-full h-full object-contain p-1"
                    fallbackClass="w-full h-full opacity-60"
                  />
                </div>
                <p className="text-xs font-semibold line-clamp-3 leading-snug">{topSaver.title}</p>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-xl font-bold font-data">{topSaver.currency} {topSaver.currentPrice.toFixed(2)}</p>
                <span className="bg-[var(--on-brand)] text-brand-strong font-bold text-xs px-2.5 py-1 rounded-full">{topSaver.discountPercent}% OFF</span>
              </div>
              <Link to={`/product/${topSaver.id}`} className="block mt-3 text-center text-xs font-bold bg-black/10 hover:bg-black/20 rounded-xl py-2 transition-colors">
                View Deal
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-4">Quick Links</h3>
            <div className="space-y-2">
              {[
                { to: '/search?q=laptop', label: 'Trending: Laptops' },
                { to: '/search?q=smartphone', label: 'Trending: Smartphones' },
                { to: '/search?q=headphones', label: 'Trending: Headphones' },
                { to: '/search?q=gaming+console', label: 'Trending: Gaming' },
              ].map(l => (
                <Link key={l.to} to={l.to}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-brand-soft hover:text-brand text-sm text-muted font-medium transition-colors group">
                  {l.label}
                  <svg className="w-3.5 h-3.5 text-faint group-hover:text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Join CTA */}
          <div className="bg-brand rounded-2xl p-5 text-on-brand">
            <p className="font-bold text-base mb-1">Track any product</p>
            <p className="text-xs mb-4 opacity-80">Search, wishlist, and get alerted when prices drop.</p>
            <Link to="/search" className="block text-center text-sm font-bold bg-[var(--on-brand)] text-brand-strong py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Start Searching
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
