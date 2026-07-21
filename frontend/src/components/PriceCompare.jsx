import { useEffect, useState } from 'react';
import api from '../api/axios';

// Shows other retailer listings found for this product's search query, side
// by side with the price already being tracked. Not merged into the tracked
// product's own price history — just a supplementary comparison view.
export default function PriceCompare({ productId, currentPrice, currency, currentUrl }) {
  const [listings, setListings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/products/${productId}/compare`)
      .then(r => { if (active) setListings(r.data.listings || []); })
      .catch(() => { if (active) setListings([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  if (loading) {
    return <div className="card p-6 mt-6 h-24 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />;
  }
  if (!listings || listings.length === 0) return null;

  const cheapest = listings.reduce((min, l) => (l.price < min.price ? l : min), listings[0]);
  const cheaperThanTracked = cheapest.price < currentPrice;

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Compare Prices</h2>
        {cheaperThanTracked && (
          <span className="badge badge-green text-xs">Cheaper elsewhere</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* The listing being tracked, shown first for reference */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--brand)', backgroundColor: 'var(--brand-soft)' }}>
          <div className="min-w-0">
            <p className="text-xs font-bold" style={{ color: 'var(--brand-strong, var(--brand))' }}>Currently tracked</p>
            {currentUrl && (
              <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs truncate block hover:underline" style={{ color: 'var(--text-muted)' }}>
                {(() => { try { return new URL(currentUrl).hostname.replace('www.', ''); } catch { return currentUrl; } })()}
              </a>
            )}
          </div>
          <span className="text-sm font-bold price-tag shrink-0">{currency} {currentPrice.toFixed(2)}</span>
        </div>

        {listings.map((l, i) => (
          <div key={`${l.source}-${i}`} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg)' }}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{l.source}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{l.title}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="text-sm font-bold font-data"
                style={{ color: l.price < currentPrice ? 'var(--success)' : 'var(--text)' }}
              >
                {l.currency} {l.price.toFixed(2)}
              </span>
              {l.url && (
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand hover:text-[var(--brand-strong)] whitespace-nowrap">
                  Visit →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Other listings found for this search, from Google Shopping. Prices and availability may change.
      </p>
    </div>
  );
}
