// Tiny inline price line, no axes. Green when the last point is below the
// first, red when above, neutral when flat. Pure SVG so it costs nothing.
export default function Sparkline({ points = [], width = 96, height = 28, className = '' }) {
  const pts = (points || []).filter(p => Number.isFinite(p));
  if (pts.length < 2) return <span className={`inline-block ${className}`} style={{ width, height }} aria-hidden="true" />;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (pts.length - 1);
  const d = pts.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p - min) / span) * (height - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const first = pts[0], last = pts[pts.length - 1];
  const color = last < first ? 'var(--success)' : last > first ? 'var(--danger)' : 'var(--text-faint)';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pad + (pts.length - 1) * step} cy={pad + (1 - (last - min) / span) * (height - pad * 2)} r="2" fill={color} />
    </svg>
  );
}
