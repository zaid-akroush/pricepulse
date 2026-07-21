import { useEffect, useState } from 'react';
import api from '../api/axios';

// Buy-now-vs-wait recommendation backed by the /forecast endpoint.
const TONE = {
  buy:     { tier: 'success' },
  wait:    { tier: 'warning' },
  neutral: { tier: null },
};

export default function PricePrediction({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/products/${productId}/forecast`)
      .then(r => { if (active) setData(r.data); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  if (loading) {
    return <div className="card p-6 mt-6 h-32 animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />;
  }
  if (!data) return null;

  if (!data.enoughData) {
    return (
      <div className="card p-6 mt-6">
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>Price Forecast</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {data.message || 'Not enough price history to forecast yet. Check back after a few price updates.'}
        </p>
      </div>
    );
  }

  const tone = TONE[data.recommendation.tone] || TONE.neutral;
  const cur = data.currentPrice;
  const f7 = data.predicted7d;
  const diff7 = f7 - cur;
  const diffPct = cur > 0 ? (diff7 / cur) * 100 : 0;
  const rising = diff7 > 0;
  const fmt = (v) => `${data.currency} ${v.toFixed(2)}`;
  const trendTier = rising ? 'danger' : 'success';

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Price Forecast</h2>
        <span className="badge surface-3 text-muted" title="How confident the model is, based on fit quality and amount of history">
          {data.confidence}% confidence
        </span>
      </div>

      {/* Recommendation banner */}
      <div
        className="rounded-2xl border p-4 flex items-start gap-3 mb-5"
        style={{
          borderColor: tone.tier ? `var(--${tone.tier})` : 'var(--border)',
          backgroundColor: tone.tier ? `var(--${tone.tier}-soft)` : 'var(--surface-3)',
        }}
      >
        <span
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: tone.tier ? `var(--${tone.tier})` : 'var(--text-faint)' }}
          aria-hidden="true"
        />
        <div>
          <p
            className="font-bold text-lg leading-tight"
            style={{ color: tone.tier ? `var(--${tone.tier})` : 'var(--text)' }}
          >
            {data.recommendation.action}
          </p>
          <p className="text-sm text-muted mt-0.5">{data.recommendation.reason}</p>
        </div>
      </div>

      {/* Forecast metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>In ~7 days</p>
          <p className="text-base font-bold font-data" style={{ color: `var(--${trendTier})` }}>{fmt(f7)}</p>
          <p className="text-[11px] font-semibold font-data" style={{ color: `var(--${trendTier})` }}>
            {rising ? '▲' : '▼'} {Math.abs(diffPct).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>In ~30 days</p>
          <p className="text-base font-bold font-data" style={{ color: 'var(--text)' }}>{fmt(data.predicted30d)}</p>
          <p className="text-[11px] font-semibold font-data" style={{ color: 'var(--text-muted)' }}>
            {data.trendPerDayPct >= 0 ? '+' : ''}{data.trendPerDayPct}%/day
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>vs all-time</p>
          <p className="text-base font-bold font-data" style={{ color: 'var(--text)' }}>{data.pricePosition}%</p>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>of price range</p>
        </div>
      </div>

      {/* Position meter: where current price sits between lowest and highest.
          Fill runs success -> warning -> danger (low price = good). */}
      <div className="mt-4">
        <div
          className="h-2 rounded-full relative"
          style={{ backgroundImage: 'linear-gradient(to right, var(--success), var(--warning), var(--danger))' }}
        >
          <div
            className="absolute -top-1 w-4 h-4 rounded-full border-2 shadow"
            style={{
              left: `calc(${Math.min(100, Math.max(0, data.pricePosition))}% - 8px)`,
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--ink)',
            }}
            title="Current price position"
          />
        </div>
        <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          <span>Lowest ever</span>
          <span>Highest ever</span>
        </div>
      </div>

      <p className="text-[10px] mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Estimated from {data.points} price points via linear regression. Forecasts are indicative, not guaranteed.
      </p>
    </div>
  );
}
