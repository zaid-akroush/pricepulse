import { useMemo, useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';

// Savings-over-time line: for every day, how much cheaper the tracked
// products were than their peak-so-far, summed across the wishlist. Data
// comes from GET /api/wishlist/analytics (savingsTimeline), in USD; the
// display currency is applied here like everywhere else.
export default function SavingsChart({ timeline = [], currency = 'USD' }) {
  const { format } = useCurrency();
  const [hover, setHover] = useState(null);

  const W = 640, H = 180, PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 24;
  const pts = useMemo(() => (timeline || []).map(t => ({ ...t, saved: Number(t.saved) || 0 })), [timeline]);
  const withData = pts.filter(p => p.tracked > 0);
  if (pts.length < 2 || withData.length < 2) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        The savings curve appears once your products have a few days of price history.
      </p>
    );
  }

  const max = Math.max(...pts.map(p => p.saved), 1);
  const x = i => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - PAD_R);
  const y = v => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.saved).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const last = pts[pts.length - 1];
  const peakIdx = pts.reduce((best, p, i) => (p.saved > pts[best].saved ? i : best), 0);
  const label = d => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width * W;
    const i = Math.round((rel - PAD_L) / (W - PAD_L - PAD_R) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  const h = hover != null ? pts[hover] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {h ? `${label(h.date)}: ` : 'Today: '}
          <span className="font-bold font-data text-success">{format(h ? h.saved : last.saved, currency)}</span>
          {' '}below peak across {h ? h.tracked : last.tracked} products
        </p>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          best day {label(pts[peakIdx].date)}: {format(pts[peakIdx].saved, currency)}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label="Savings versus peak price over the last 90 days"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth="1" />
        <path d={area} fill="url(#savingsFill)" />
        <path d={line} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinejoin="round" />
        {h && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={y(0)} stroke="var(--text-faint)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.saved)} r="4" fill="var(--success)" stroke="var(--surface)" strokeWidth="2" />
          </>
        )}
        <text x={PAD_L} y={H - 6} fontSize="11" fill="var(--text-faint)">{label(pts[0].date)}</text>
        <text x={W - PAD_R} y={H - 6} fontSize="11" fill="var(--text-faint)" textAnchor="end">{label(last.date)}</text>
      </svg>
    </div>
  );
}
