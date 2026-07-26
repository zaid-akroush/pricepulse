import { useState, useMemo, useRef } from 'react';
import { useCurrency } from '../context/CurrencyContext';

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
  const { convert } = useCurrency();
  // Every point converts from the SAME source currency, so the display
  // currency is just whatever the first converted point resolves to.
  const displayCurrency = convert(0, currency).currency;

  // How many days back the earliest price check actually goes. Any range
  // button whose window is wider than this would show exactly the same
  // data as "All" — greyed out below so it's clear they're not broken,
  // there just isn't older history yet.
  const trackedDays = useMemo(() => {
    const all = history || [];
    if (all.length === 0) return 0;
    const oldest = Math.min(...all.map(h => new Date(h.recordedAt).getTime()));
    return Math.max(1, Math.ceil((Date.now() - oldest) / 86400000));
  }, [history]);

  // If the currently-selected range is one of the greyed-out ones (e.g. the
  // default 1Y on a product tracked for only a few days), fall back to
  // "All" so we're never rendering a filter that has no effect and no
  // visual indication of why.
  const effectiveRange = (() => {
    const active = RANGES.find(r => r.label === range);
    if (active?.days != null && active.days > trackedDays) return 'All';
    return range;
  })();

  const filtered = useMemo(() => {
    const all = history || [];
    const active = RANGES.find(r => r.label === effectiveRange);
    if (!active || active.days == null) return all;
    const cutoff = Date.now() - active.days * 86400000;
    return all.filter(h => new Date(h.recordedAt).getTime() >= cutoff);
  }, [history, effectiveRange]);

  if (!history || history.length < 2) {
    return <p className="text-xs text-faint text-center py-4">Not enough price history yet.</p>;
  }

  const rangePicker = (
    <div className="flex flex-col items-end gap-1 mb-2">
      <div className="flex items-center gap-1">
        {RANGES.map(r => {
          const disabled = r.days != null && r.days > trackedDays;
          return (
            <button
              key={r.label}
              onClick={() => !disabled && setRange(r.label)}
              disabled={disabled}
              title={disabled ? `Only tracked for ${trackedDays} day${trackedDays === 1 ? '' : 's'} so far, this range has no extra data yet` : undefined}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                disabled
                  ? 'opacity-35 cursor-not-allowed text-muted'
                  : effectiveRange === r.label
                    ? 'bg-brand text-on-brand'
                    : 'surface-3 text-muted hover:text-brand'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-faint">
        Tracked for {trackedDays} day{trackedDays === 1 ? '' : 's'} so far
      </span>
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

  const prices = filtered.map(h => convert(h.price, currency).amount);
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
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: displayCurrency, maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${displayCurrency} ${Math.round(v)}`;
    }
  };
  const formatPriceFull = (v) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: displayCurrency, maximumFractionDigits: 2 }).format(v);
    } catch {
      return `${displayCurrency} ${v.toFixed(2)}`;
    }
  };

  const xTickCount = Math.min(5, points.length);
  const xTickIdx = [...new Set(
    Array.from({ length: xTickCount }, (_, i) =>
      Math.round((i * (points.length - 1)) / Math.max(1, xTickCount - 1))
    )
  )];
  // When every point in the visible range falls on the same calendar day
  // (e.g. a brand-new product with only same-day checks so far), a plain
  // date formatter would print the identical label at every tick. Fall
  // back to a time-of-day format in that case so the ticks stay distinct.
  const sameDay = dates.length > 0 && dates.every(d => d.toDateString() === dates[0].toDateString());
  const formatDate = (d) => sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const formatDateFull = (d) => sameDay
    ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

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
          <span className="font-data">{formatPriceFull(Math.abs(latest - first))}</span>
          <span className="text-muted font-normal">over this range</span>
        </span>
        {rangePicker}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          // Locking the rendered aspect ratio to match the viewBox means
          // preserveAspectRatio="none" never actually has to stretch
          // anything non-uniformly. Without this, the container's real
          // width/height ratio (set by CSS layout, unrelated to W:H here)
          // could differ from 460:200, and the browser would squish text
          // and lines horizontally or vertically to fill it — small axis
          // labels like "HUF" become badly compressed and unreadable.
          style={{ aspectRatio: `${W} / ${H}` }}
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

          {/* X-axis date labels. The first/last ticks sit right at the plot
              edges, so a centered anchor would push half the text past the
              SVG's viewBox and get clipped by the browser's default SVG
              overflow:hidden — anchor those two to start/end instead. */}
          <g fill="var(--text-faint)" fontFamily="'IBM Plex Mono', monospace">
            {xTickIdx.map((i, idx) => {
              const anchor = idx === 0 ? 'start' : idx === xTickIdx.length - 1 ? 'end' : 'middle';
              return (
                <text key={i} x={xAt(i)} y={H - 6} fontSize="9" textAnchor={anchor}>
                  {formatDate(dates[i])}
                </text>
              );
            })}
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
