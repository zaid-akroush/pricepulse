import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PriceChart from '../components/PriceChart';
import ProductImage from '../components/ProductImage';
import DealScore, { getDealScore } from '../components/DealScore';
import PricePrediction from '../components/PricePrediction';
import PriceCompare from '../components/PriceCompare';
import ProductSpecs from '../components/ProductSpecs';
import Price from '../components/Price';
import { FadeIn } from '../components/motion';

// Helpers

function getTrend(history) {
  if (!history || history.length < 2) return null;
  const recent = history.slice(-5);
  const first = recent[0].price;
  const last = recent[recent.length - 1].price;
  const diff = ((last - first) / first) * 100;
  if (Math.abs(diff) < 1) return { dir: 'stable', label: 'Stable', color: 'text-muted', icon: '→' };
  if (diff < 0) return { dir: 'down', label: `↓ ${Math.abs(diff).toFixed(1)}% recently`, color: 'text-success', icon: '↓' };
  return { dir: 'up', label: `↑ ${diff.toFixed(1)}% recently`, color: 'text-danger', icon: '↑' };
}

function exportCSV(product) {
  const rows = [['Date', 'Price', 'Currency']];
  (product.priceHistory || []).forEach(h => {
    rows.push([new Date(h.recordedAt).toLocaleDateString(), h.price.toFixed(2), product.currency]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${product.title.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}_price_history.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Sub-components

function CommentsSection({ productId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.get(`/social/comments/${productId}`)
      .then(r => setComments(r.data))
      .finally(() => setLoading(false));
  }, [productId]);

  async function post(e) {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await api.post(`/social/comments/${productId}`, { text });
      setComments(prev => [res.data, ...prev]);
      setText('');
    } finally { setPosting(false); }
  }

  async function deleteComment(id) {
    await api.delete(`/social/comments/${id}`);
    setComments(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="card p-6 mt-6">
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>
        Community Notes ({comments.length})
      </h2>

      <form onSubmit={post} className="flex gap-2 mb-5">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={user ? 'Share a tip, deal alert, or note…' : 'Login to leave a comment'}
          className="input flex-1 text-sm"
          disabled={!user}
        />
        {user ? (
          <button type="submit" disabled={posting || !text.trim()}
            className="btn-primary text-sm px-4 shrink-0 disabled:opacity-50">
            {posting ? '…' : 'Post'}
          </button>
        ) : (
          <Link to="/login" className="btn-primary text-sm px-4 shrink-0">Login</Link>
        )}
      </form>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse surface-3" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No notes yet. Be the first to share a tip!</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold shrink-0">
                {c.user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{c.user.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>{c.text}</p>
              </div>
              {user && user.id === c.user.id && (
                <button onClick={() => deleteComment(c.id)} className="text-faint hover:text-danger text-lg leading-none shrink-0" title="Delete comment" aria-label="Delete comment">×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedProducts({ productId }) {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/products/${productId}/related`)
      .then(r => setRelated(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  const navigate = useNavigate();

  if (!loading && related.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text)' }}>Similar Products</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No similar tracked products yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>Similar Products</h2>
      <div className="flex flex-col gap-3">
        {loading
          ? [...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg)' }} />)
          : related.map(p => (
            <div key={p.id} className="rounded-xl p-2.5 transition-colors bg-app hover:bg-app-subtle">
              <div className="flex gap-3 cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                <div className="w-14 h-14 rounded-lg overflow-hidden surface shrink-0 flex items-center justify-center">
                  <ProductImage src={p.imageUrl} alt={p.title} productId={p.id} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium line-clamp-2 leading-snug" style={{ color: 'var(--text)' }}>{p.title}</p>
                  <p className="text-sm price-tag mt-1"><Price amount={p.currentPrice} currency={p.currency} /></p>
                </div>
              </div>
              {p.url && (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="mt-2 block text-center text-[11px] font-semibold text-brand hover:text-[var(--brand-strong)] border rounded-lg py-1 transition-colors"
                  style={{ borderColor: 'var(--border)' }}>
                  View price at store →
                </a>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function LikeButton({ productId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/social/likes/${productId}`)
      .then(r => { setLiked(r.data.liked); setCount(r.data.count); })
      .catch(() => {});
  }, [productId]);

  async function toggle() {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    try {
      const method = liked ? 'delete' : 'post';
      const res = await api[method](`/social/like/${productId}`);
      setLiked(res.data.liked);
      setCount(res.data.count);
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${liked ? 'bg-danger-soft text-danger border-danger' : 'text-muted hover:text-danger'}`}
      style={liked ? undefined : { borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7.5-4.6-10-9.1C.5 8.2 2.4 5 6 5c2 0 3.5 1 6 3.5C14.5 6 16 5 18 5c3.6 0 5.5 3.2 4 6.9C19.5 16.4 12 21 12 21z" />
      </svg>
      <span>{count}</span>
    </button>
  );
}

// Main Page

export default function ProductDetail() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [added, setAdded] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`)
      .then(res => setProduct(res.data))
      .catch(err => setError(err.response?.status === 404 ? 'Product not found.' : 'Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddToWishlist() {
    if (!currentUser) { navigate('/login'); return; }
    setAddLoading(true);
    try {
      await api.post('/wishlist', {
        title: product.title, url: product.url, imageUrl: product.imageUrl,
        currentPrice: product.currentPrice, currency: product.currency,
        serpApiQuery: product.serpApiQuery,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      });
      setAdded(true);
    } finally { setAddLoading(false); }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied!');
    } catch {
      setShareMsg(url);
    }
    setTimeout(() => setShareMsg(''), 3000);
  }

  async function handleRefresh() {
    // /products/:id/refresh calls the paid price-lookup API, so it now
    // requires being logged in (ties usage to an account instead of being
    // fully anonymous).
    if (!currentUser) { navigate('/login'); return; }
    setRefreshing(true); setRefreshMsg('');
    try {
      const { data } = await api.post(`/products/${id}/refresh`);
      if (data.updated) {
        setProduct(data.product);
        setRefreshMsg('Price updated!');
      } else {
        setRefreshMsg(data.message || 'No live price available right now.');
      }
    } catch (err) {
      setRefreshMsg(err.response?.data?.error || 'Could not refresh right now.');
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(''), 3000);
    }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="card h-96 animate-pulse surface-2" />
    </div>
  );
  if (error) return <div className="text-center py-20 text-danger">{error}</div>;
  if (!product) return null;

  const dropPercent = product.highestPrice > 0
    ? Math.round(((product.highestPrice - product.currentPrice) / product.highestPrice) * 100)
    : 0;

  const trend = getTrend(product.priceHistory);
  let retailer = '';
  try { retailer = new URL(product.url || '').hostname.replace('www.', ''); } catch {}

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-1 mb-6 transition-colors hover:text-brand" style={{ color: 'var(--text-muted)' }}>
        ← Back
      </button>

      <FadeIn className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="card p-6 flex items-center justify-center min-h-64">
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            productId={product.id}
            className="max-h-64 w-full object-contain"
            fallbackClass="h-40 w-full"
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{product.title}</h1>

          {/* Price row */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl price-tag"><Price amount={product.currentPrice} currency={product.currency} /></span>
            {dropPercent > 0 && (
              <span className="badge badge-green text-sm">{dropPercent}% below peak</span>
            )}
            <DealScore
              currentPrice={product.currentPrice}
              lowestPrice={product.lowestPrice}
              highestPrice={product.highestPrice}
            />
          </div>

          {/* Trend */}
          {trend && (
            <div className={`flex items-center gap-2 text-sm font-medium ${trend.color}`}>
              <span className="text-lg">{trend.icon}</span>
              <span>Price trending: {trend.label}</span>
            </div>
          )}

          {/* Low / High */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-success-soft rounded-xl p-3 text-center">
              <p className="text-xs text-success font-medium">Lowest Ever</p>
              <p className="text-lg font-bold price-tag text-success"><Price amount={product.lowestPrice} currency={product.currency} /></p>
            </div>
            <div className="bg-danger-soft rounded-xl p-3 text-center">
              <p className="text-xs text-danger font-medium">Highest Ever</p>
              <p className="text-lg font-bold price-tag text-danger"><Price amount={product.highestPrice} currency={product.currency} /></p>
            </div>
          </div>

          {/* Retailer */}
          {retailer && (
            <p className="text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l1-5h16l1 5" /><path d="M4 9v10h16V9" /><path d="M9 19v-6h6v6" />
              </svg>
              Available at <strong>{retailer}</strong>
            </p>
          )}

          {/* Actions row */}
          <div className="flex gap-2 flex-wrap">
            {product.url && (
              <a href={product.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-center text-sm flex-1">
                View on Store →
              </a>
            )}
            <LikeButton productId={product.id} />
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-xl text-sm font-medium border transition-colors hover:border-brand hover:text-brand"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--surface)' }}
              title="Share product"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
            </button>
          </div>
          {shareMsg && <p className="text-xs text-success font-medium">{shareMsg}</p>}

          {/* Add to wishlist */}
          {!added ? (
            <div className="flex gap-2">
              <input type="number" placeholder="Target price (optional)" value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)} className="input flex-1 text-sm" />
              <button onClick={handleAddToWishlist} disabled={addLoading}
                className="btn-primary shrink-0 disabled:opacity-50 text-sm px-4">
                {addLoading ? '…' : '+ Wishlist'}
              </button>
            </div>
          ) : (
            <div className="text-success font-semibold text-sm flex items-center gap-2 bg-success-soft p-3 rounded-xl">
              ✓ Added to your wishlist
            </div>
          )}

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Last checked: {product.lastChecked ? new Date(product.lastChecked).toLocaleString() : 'Not yet monitored'}
          </p>
        </div>
      </FadeIn>

      {/* Main content + similar-products sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-6">

      {/* Product details / specs */}
      <ProductSpecs title={product.title} />

      {/* Price History Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Price History</h2>
          <div className="flex items-center gap-2">
            {refreshMsg && <span className="text-xs font-medium text-success">{refreshMsg}</span>}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              title="Fetch the current price now and add it to the history"
            >
              {refreshing ? 'Checking…' : '↻ Check price now'}
            </button>
            <button
              onClick={() => exportCSV(product)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:border-brand hover:text-brand"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              ↓ Export CSV
            </button>
          </div>
        </div>
        {(product.priceHistory?.length ?? 0) < 2 && (
          <p className="text-xs mb-3 p-2.5 rounded-lg" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
            Only one price recorded so far. Use <strong>Check price now</strong> or wait for the next automatic check. The graph appears once there are at least two points.
          </p>
        )}
        <PriceChart history={product.priceHistory || []} currency={product.currency} />
        {product.priceHistory?.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto">
            <table className="w-full text-xs" style={{ color: 'var(--text-muted)' }}>
              <thead className="text-left border-b" style={{ borderColor: 'var(--border)' }}>
                <tr><th className="pb-2">Date</th><th className="pb-2">Price</th></tr>
              </thead>
              <tbody>
                {[...product.priceHistory].reverse().map(h => (
                  <tr key={h.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-1.5 font-data">{new Date(h.recordedAt).toLocaleDateString()}</td>
                    <td className="py-1.5 font-semibold font-data" style={{ color: 'var(--text)' }}><Price amount={h.price} currency={product.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price Forecast */}
      <PricePrediction productId={product.id} />

      {/* Compare Prices Across Retailers */}
      <PriceCompare productId={product.id} currentPrice={product.currentPrice} currency={product.currency} currentUrl={product.url} />

      {/* Comments */}
      <CommentsSection productId={product.id} />

        </div>{/* /main column */}

        {/* Similar products sidebar */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <RelatedProducts productId={product.id} />
          </div>
        </aside>
      </div>{/* /content grid */}
    </div>
  );
}
