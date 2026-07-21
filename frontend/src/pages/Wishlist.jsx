import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import WishlistItem from '../components/WishlistItem';
import PageHeader from '../components/PageHeader';
import { FadeIn, Stagger, StaggerItem } from '../components/motion';

function ShareWishlist() {
  const [token, setToken] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  useEffect(() => {
    api.get('/social/share-wishlist')
      .then(res => setToken(res.data.token))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : null;

  async function enable() {
    setLoading(true);
    try {
      const res = await api.post('/social/share-wishlist');
      setToken(res.data.token);
    } finally { setLoading(false); }
  }

  async function revoke() {
    if (!confirm('Revoke this share link? Anyone with the old link will lose access.')) return;
    setLoading(true);
    try {
      await api.delete('/social/share-wishlist');
      setToken(null);
    } finally { setLoading(false); }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg('Copied!');
    } catch {
      setCopyMsg(shareUrl);
    }
    setTimeout(() => setCopyMsg(''), 3000);
  }

  if (!checked) return null;

  return (
    <div className="card p-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-app">Share your wishlist</p>
        <p className="text-xs text-muted mt-0.5">
          {token
            ? 'Anyone with this link can view your wishlist (read-only). No account details are shared.'
            : 'Generate a public link so others (e.g. for a gift list) can see what you\'re tracking.'}
        </p>
        {token && (
          <p className="text-xs font-data mt-2 truncate px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            {shareUrl}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {token ? (
          <>
            <button onClick={copy} className="btn-secondary text-sm px-4">{copyMsg || 'Copy Link'}</button>
            <button onClick={revoke} disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-medium border transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--surface)' }}>
              Revoke
            </button>
          </>
        ) : (
          <button onClick={enable} disabled={loading} className="btn-primary text-sm px-4 disabled:opacity-50">
            {loading ? '…' : 'Get Share Link'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/wishlist')
      .then(res => setItems(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load wishlist'))
      .finally(() => setLoading(false));
  }, []);

  const totalValue = items.reduce((sum, i) => sum + i.product.currentPrice, 0);
  const totalSaved = items.reduce((sum, i) => sum + Math.max(0, i.product.highestPrice - i.product.currentPrice), 0);
  const trackedItems = items.filter(i => i.targetPrice);

  // Segment items into organized sections so the page isn't just one long
  // flat list. Items are grouped by where each stands relative to its target
  // and its all-time price range.
  const atTarget = [];
  const dropped = [];
  const steady = [];
  for (const item of items) {
    const { product } = item;
    const hitTarget = item.targetPrice != null && product.currentPrice <= item.targetPrice;
    const droppedFromPeak = product.highestPrice > product.currentPrice;
    if (hitTarget) atTarget.push(item);
    else if (droppedFromPeak) dropped.push(item);
    else steady.push(item);
  }
  const segments = [
    { key: 'atTarget', title: 'Hit Your Target', items: atTarget },
    { key: 'dropped', title: 'Price Dropped', items: dropped },
    { key: 'steady', title: 'Steady', items: steady },
  ].filter(s => s.items.length > 0);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl animate-pulse surface-3" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-danger font-medium">{error}</p>
    </div>
  );

  return (
    <div className="bg-app min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <PageHeader
          eyebrow="Tracking"
          title="My Wishlist"
          subtitle={items.length === 0 ? 'No products tracked yet' : `${items.length} product${items.length !== 1 ? 's' : ''} tracked`}
          className="mb-8"
        />

        {/* Share link */}
        {items.length > 0 && <ShareWishlist />}

        {/* Stats */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="card p-4">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Total Value</p>
              <p className="text-xl font-bold font-data text-app">${totalValue.toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Saved vs Peak</p>
              <p className="text-xl font-bold font-data text-success">${totalSaved.toFixed(2)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-1">Alerts Set</p>
              <p className="text-xl font-bold font-data text-brand">{trackedItems.length}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </div>
            <p className="text-lg font-bold text-app mb-2">Your wishlist is empty</p>
            <p className="text-sm text-muted mb-6">Search for products and add them to start tracking prices.</p>
            <Link to="/search" className="btn-primary">Search Products</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {segments.map(segment => (
              <div key={segment.key}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
                    {segment.title}
                  </h2>
                  <span className="text-[10px] font-bold text-muted surface-3 rounded-full px-2 py-0.5">
                    {segment.items.length}
                  </span>
                </div>
                <Stagger className="flex flex-col gap-4" stagger={0.06}>
                  {segment.items.map(item => (
                    <StaggerItem key={item.id}>
                      <WishlistItem
                        item={item}
                        onRemove={id => setItems(prev => prev.filter(i => i.id !== id))}
                        onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
