// PricePulse mark: an EKG-style pulse that resolves into a falling trend
// line, capped with a dot, i.e. "we monitor the pulse of a price until it
// drops." Uses the brand/on-brand CSS vars so it stays correct in both
// themes; frontend/public/logo.svg is a static, hardcoded twin of this for
// contexts (favicon, manifest, OG image) that can't read CSS variables.
export default function Logo({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path
        d="M7 35h8l6-15 7 26 7-34 6 20h7l10 15"
        fill="none"
        stroke="var(--on-brand)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
