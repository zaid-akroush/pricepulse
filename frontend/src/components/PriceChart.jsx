import { useState, useMemo, useRef } from 'react';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
];

// Dependency-free SVG line chart for price history, with a hover
// crosshair + tooltip. Color is a status signal (down = success, up =
// danger) and is always paired with a ▲/▼ glyph so the direction never
// depends on hue alone (colorblind-safe by construction).
export default function PriceChart({ history, currency = 'USD' }) {
  const [range, setRange] = useState('1Y');
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  const filtered = useMemo(() => {
    const all = history || [];
    const active = RANGES.find(r => r.label === range);
    if (!active || active.days == null) return all;
    const cutoff = Date.now() - active.days * 86400000;
    return all.filter(h => new Date(h.recordedAt).getTime() >= cutoff);
  }, [history, range]);

  if (!history || history.length < 2) {
    return <p className="text-xs text-faint text-center py-4">Not enough price history yet.</p>;
  }

  const rangePicker = (
    <div className="flex justify-end gap-1 mb-2">
      {RANGES.map(r => (
        <button
          key={r.label}
          onClick={() => setRange(r.label)}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
            range === r.label
              ? 'bg-brand text-on-brand'
              : 'surface-3 text-muted hover:text-brand'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (filtered.length < 2) {
    return (
      <div className="w-full">
        {rangePicker}
        <p className="text-xs text-faint text-center py-4">No price data in this range, try a wider one.</p>
      </div>
    );
  }

  const prices = filtered.map(h => h.price);
  const dates = filtered.map(h => new Date(h.recordedAt));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const spread = maxP - minP || 1;
  const yPad = spread * 0.1;
  const domainMin = minP - yPad;
  const domainMax = maxP + yPad;
  const domainSpread = domainMax - domainMin || 1;

  const W = 460, H = 200;
  const PAD = { top: 12, right: 12, bottom: 26, left: 58 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xAt = (i) => PAD.left + (prices.length > 1 ? (i / (prices.length - 1)) * plotW : plotW / 2);
  const yAt = (p) => PAD.top + (1 - (p - domainMin) / domainSpread) * plotH;

  const points = prices.map((p, i) => [xAt(i), yAt(p)]);
  const polyline = points.map(([x, y]) => `${x},${y}`).join(' ');
  const baseline = PAD.top + plotH;
  const areaPath = `M${points[0][0]},${baseline} L${points.map(([x, y]) => `${x},${y}`).join(' L')} L${points[points.length - 1][0]},${baseline} Z`;

  const latest = prices[prices.length - 1];
  const first = prices[0];
  const isDown = latest < first;
  const colorVar = isDown ? 'var(--success)' : 'var(--danger)';
  const gradId = isDown ? 'pp-grad-success' : 'pp-grad-danger';

  const Y_TICKS = 4;
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => domainMin + (domainSpread * i) / Y_TICKS);
  const formatPrice = (v) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${currency} ${Math.round(v)}`;
    }
  };
  const formatPriceFull = (v) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);
    } catch {
      return `${currency} ${v.toFixed(2)}`;
    }
  };

  const xTickCount = Math.min(5, points.length);
  const xTickIdx = [...new Set(
    Array.from({ length: xTickCount }, (_, i) =>
      Math.round((i * (points.length - 1)) / Math.max(1, xTickCount - 1))
    )
  )];
  const formatDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const formatDateFull = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  function nearestIndex(clientX) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let best = 0, bestDist = Infinity;
    points.forEach(([x], i) => {
      const d = Math.abs(x - relX);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;
  const tooltipLeft = hovered ? (hovered[0] / W) * 100 : 0;
  const tooltipAlignEnd = hovered && hovered[0] > W * 0.62;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold flex items-center gap-1" style={{ color: colorVar }}>
          <span aria-hidden="true">{isDown ? '▼' : '▲'}</span>
          <span className="font-data">{currency} {Math.abs(latest - first).toFixed(2)}</span>
          <span className="text-muted font-normal">over this range</span>
        </span>
        {rangePicker}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          preserveAspectRatio="none"
          onPointerMove={(e) => setHoverIdx(nearestIndex(e.clientX))}
          onPointerLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorVar} stopOpacity="0.12" />
              <stop offset="100%" stopColor={colorVar} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines (hairline, recessive) + price labels */}
          <g stroke="var(--border)" strokeWidth="1">
            {yTicks.map((t, i) => (
              <line key={i} x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} />
            ))}
          </g>
          <g fill="var(--text-faint)" fontFamily="'IBM Plex Mono', monospace">
            {yTicks.map((t, i) => (
              <text key={i} x={PAD.left - 8} y={yAt(t)} dy="3" fontSize="9" textAnchor="end">
                {formatPrice(t)}
              </text>
            ))}
          </g>

          {/* Axis lines */}
          <g stroke="var(--text-faint)" strokeWidth="1.5">
            <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={baseline} />
            <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} />
          </g>

          {/* X-axis date labels */}
          <g fill="var(--text-faint)" fontFamily="'IBM Plex Mono', monospace">
            {xTickIdx.map((i) => (
              <text key={i} x={xAt(i)} y={H - 6} fontSize="9" textAnchor="middle">
                {formatDate(dates[i])}
              </text>
            ))}
          </g>

          {/* Price line + fill */}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <polyline points={polyline} fill="none" stroke={colorVar} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* End marker: >=8px, surface ring */}
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="5" fill="var(--surface)" />
          <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="4" fill={colorVar} />

          {/* Hover crosshair + point */}
          {hovered && (
            <g>
              <line x1={hovered[0]} x2={hovered[0]} y1={PAD.top} y2={baseline} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx={hovered[0]} cy={hovered[1]} r="6" fill="var(--surface)" />
              <circle cx={hovered[0]} cy={hovered[1]} r="4" fill={colorVar} />
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="absolute top-1 pointer-events-none surface border border-app-strong rounded-lg shadow-soft px-2.5 py-1.5 text-xs whitespace-nowrap"
            style={{
              left: `${tooltipLeft}%`,
              transform: tooltipAlignEnd ? 'translateX(-100%)' : 'translateX(0%)',
            }}
          >
            <div className="font-bold font-data text-app">{formatPriceFull(prices[hoverIdx])}</div>
            <div className="text-faint">{formatDateFull(dates[hoverIdx])}</div>
          </div>
        )}
      </div>
    </div>
  );
}
