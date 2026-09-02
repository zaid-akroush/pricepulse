import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api/axios';
import PriceChart from '../components/PriceChart';
import ProductImage from '../components/ProductImage';
import ProductGallery from '../components/ProductGallery';
import AdminDiagnostic from '../components/AdminDiagnostic';
import DealScore, { getDealScore } from '../components/DealScore';
import PricePrediction from '../components/PricePrediction';
import PriceCompare from '../components/PriceCompare';
import ProductSpecs from '../components/ProductSpecs';
import Price from '../components/Price';
import { FadeIn } from '../components/motion';
import { describeApiError } from '../api/errorMessage';

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

// Community notes.
//
// Notes are public user-generated text, so posting is governed by rules the
// server enforces (length, profanity, links, spam, flood control). Those
// rules are fetched from /social/guidelines rather than duplicated here, so
// the list a user reads can never drift from what's actually enforced. Notes
// default to "Top" order — most-upvoted first — so the genuinely useful tips
// surface instead of whatever was posted most recently.
const NOTE_MAX_FALLBACK = 500;
const NOTE_MIN_FALLBACK = 10;

function CommentsSection({ productId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('top');
  const [guidelines, setGuidelines] = useState(null);
  const [showRules, setShowRules] = useState(false);

  const maxLength = guidelines?.maxLength ?? NOTE_MAX_FALLBACK;
  const minLength = guidelines?.minLength ?? NOTE_MIN_FALLBACK;
  const trimmedLength = text.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength < minLength;
  const overLimit = trimmedLength > maxLength;

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/social/comments/${productId}`, { params: { sort } })
      .then(r => { if (active) setComments(r.data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, sort]);

  useEffect(() => {
    api.get('/social/guidelines')
      .then(r => setGuidelines(r.data))
      .catch(() => {});
  }, []);

  async function post(e) {
    e.preventDefault();
    setError('');
    if (!user) { navigate('/login'); return; }
    if (!trimmedLength || tooShort || overLimit) return;
    setPosting(true);
    try {
      const res = await api.post(`/social/comments/${productId}`, { text });
      setComments(prev => [res.data, ...prev]);
      setText('');
    } catch (err) {
      // The server returns a specific, user-facing reason (which rule was
      // broken); show it rather than a generic failure message.
      setError(describeApiError(err, 'Could not post your note. Please try again.'));
    } finally { setPosting(false); }
  }

  async function deleteComment(id) {
    await api.delete(`/social/comments/${id}`);
    setComments(prev => prev.filter(c => c.id !== id));
  }

  async function toggleLike(comment) {
    if (!user) { navigate('/login'); return; }
    // Optimistic: the vote is a single counter, so showing it immediately and
    // reconciling with the server's count keeps the button feeling instant.
    const optimistic = comment.likedByMe ? -1 : 1;
    setComments(prev => prev.map(c => c.id === comment.id
      ? { ...c, likeCount: Math.max(0, (c.likeCount || 0) + optimistic), likedByMe: !c.likedByMe }
      : c));
    try {
      const res = await api.post(`/social/comments/${comment.id}/like`);
      setComments(prev => prev.map(c => c.id === comment.id
        ? { ...c, likeCount: res.data.likeCount, likedByMe: res.data.likedByMe }
        : c));
    } catch (err) {
      setComments(prev => prev.map(c => c.id === comment.id ? comment : c));
      setError(describeApiError(err, 'Could not register your vote.'));
    }
  }

  const counterColor = overLimit || tooShort ? 'var(--danger)' : 'var(--text-muted)';

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          Community Notes ({comments.length})
        </h2>
        {comments.length > 1 && (
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
            {[['top', 'Top'], ['new', 'Newest']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${sort === key ? 'bg-brand text-on-brand' : 'text-muted hover:text-brand'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={post} className="mb-5">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e => { setText(e.target.value); if (error) setError(''); }}
            placeholder={user ? 'Share a tip, deal alert, or note…' : 'Login to leave a note'}
            className="input flex-1 text-sm"
            maxLength={maxLength + 50}
            disabled={!user}
            aria-describedby="note-rules"
          />
          {user ? (
            <button type="submit" disabled={posting || !trimmedLength || tooShort || overLimit}
              className="btn-primary text-sm px-4 shrink-0 disabled:opacity-50">
              {posting ? '…' : 'Post'}
            </button>
          ) : (
            <Link to="/login" className="btn-primary text-sm px-4 shrink-0">Login</Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowRules(v => !v)}
            className="text-[11px] font-semibold text-brand hover:underline"
            aria-expanded={showRules}
          >
            {showRules ? 'Hide posting guidelines' : 'Posting guidelines'}
          </button>
          {user && trimmedLength > 0 && (
            <span className="text-[11px] font-data" style={{ color: counterColor }}>
              {tooShort
                ? `${minLength - trimmedLength} more character${minLength - trimmedLength === 1 ? '' : 's'} needed`
                : `${trimmedLength} / ${maxLength}`}
            </span>
          )}
        </div>

        {showRules && (
          <ul id="note-rules" className="mt-2 space-y-1 text-[11px] leading-relaxed pl-4 list-disc" style={{ color: 'var(--text-muted)' }}>
            {(guidelines?.rules || [
              `Between ${minLength} and ${maxLength} characters.`,
              'Be helpful and civil, with no profanity, slurs or personal attacks.',
              'No links, phone numbers or contact details.',
              'No spam: no all-caps, repeated characters or repeated words.',
            ]).map(rule => <li key={rule}>{rule}</li>)}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-xs mt-2 font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
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
          {comments.map((c, i) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold shrink-0">
                {c.user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{c.user.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                  {/* Only meaningful in "Top" order, and only when the note
                      actually has votes behind it. */}
                  {sort === 'top' && i === 0 && c.likeCount > 0 && (
                    <span className="badge badge-green text-[10px]">Top note</span>
                  )}
                </div>
                <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--text)' }}>{c.text}</p>
                <button
                  onClick={() => toggleLike(c)}
                  disabled={user && user.id === c.user.id}
                  aria-pressed={!!c.likedByMe}
                  aria-label={c.likedByMe ? 'Remove your upvote' : 'Upvote this note'}
                  title={user && user.id === c.user.id ? "You can't vote on your own note" : undefined}
                  className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors disabled:opacity-40 disabled:cursor-default ${c.likedByMe ? 'bg-brand-soft text-brand' : 'text-muted hover:text-brand'}`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill={c.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4l7 8h-4v8h-6v-8H5z" />
                  </svg>
                  {c.likeCount || 0}
                </button>
              </div>
              {user && user.id === c.user.id && (
                <button onClick={() => deleteComment(c.id)} className="text-faint hover:text-danger text-lg leading-none shrink-0" title="Delete note" aria-label="Delete note">×</button>
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
  const [diagnostic, setDiagnostic] = useState(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [added, setAdded] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const { displayCurrency, rates } = useCurrency();

  // Inverse of CurrencyContext.convert: display currency -> the product's
  // stored currency, which is what the backend's alert comparison uses.
  function toProductCurrency(amountInDisplayCurrency) {
    if (amountInDisplayCurrency == null || Number.isNaN(amountInDisplayCurrency)) return null;
    const productCurrency = product?.currency || 'USD';
    if (!rates || displayCurrency === productCurrency) return amountInDisplayCurrency;
    const displayRate = rates[displayCurrency];
    const productRate = rates[productCurrency];
    if (!displayRate || !productRate) return amountInDisplayCurrency;
    return (amountInDisplayCurrency / displayRate) * productRate;
  }

  useEffect(() => {
    // `active` guards against two problems this effect had:
    //  1. Clicking two "similar products" quickly meant whichever request
    //     resolved LAST won, so product A could end up rendered on product
    //     B's URL.
    //  2. `error` was never reset when `id` changed, and the `if (error)`
    //     branch below wins over `product` — so once any load failed, every
    //     later navigation within this component rendered "Product not
    //     found." over a product that had in fact loaded fine.
    let active = true;
    setLoading(true);
    setError(null);
    setDiagnostic(null);
    api.get(`/products/${id}`)
      .then(res => { if (active) setProduct(res.data); })
      .catch(err => {
        if (!active) return;
        setError(err.response?.status === 404 ? 'Product not found.' : 'Failed to load product.');
        // Only populated for admins; renders nothing for anyone else.
        setDiagnostic(err.response?.data?.diagnostic || null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function handleAddToWishlist() {
    if (!currentUser) { navigate('/login'); return; }
    setAddLoading(true);
    try {
      await api.post('/wishlist', {
        title: product.title, url: product.url, imageUrl: product.imageUrl,
        currentPrice: product.currentPrice, currency: product.currency,
        serpApiQuery: product.serpApiQuery,
        // The user types a target in whatever currency the page is DISPLAYING,
        // but the backend compares it against the price in the product's OWN
        // currency. Sending the raw number meant that with the display set to
        // JOD, typing 800 (≈ $1,128) told the server to wait for $800 — an
        // alert that should have fired never did, silently. Convert back.
        targetPrice: targetPrice ? toProductCurrency(parseFloat(targetPrice)) : null,
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
      setRefreshMsg(describeApiError(err, 'Could not refresh right now.'));
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
  if (error) {
    return (
      <div className="max-w-lg mx-auto py-20 px-4 text-center">
        <p className="text-danger">{error}</p>
        <AdminDiagnostic diagnostic={diagnostic} />
      </div>
    );
  }
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
        {/* Images — a gallery of every photo we can match to this product,
            falling back to the single stored thumbnail. */}
        <ProductGallery product={product} />

        {/* Info */}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{product.title}</h1>

          {/* An unreleased product's "price" is a pre-order figure, and its
              price history is a single speculative point, so say so plainly
              rather than letting the page read like a normal listing. */}
          {product.released === false && (
            <div
              className="rounded-xl p-3 text-xs leading-relaxed border"
              style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-soft)', color: 'var(--text)' }}
            >
              <span className="font-bold">{product.releaseLabel || 'Not released yet'}.</span>{' '}
              This product isn't on sale yet, so the price shown is a pre-order or
              announced price and its history will be limited until it ships.
            </div>
          )}

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
              <input type="number" placeholder={`Target price in ${displayCurrency} (optional)`} value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)} className="input flex-1 text-sm"
                aria-label={`Target price in ${displayCurrency}`} />
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
