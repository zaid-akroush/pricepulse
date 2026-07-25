// Horizontal brand lockup: a raw heartbeat/pulse line (dot - squiggle - dot,
// no background tile) that leads directly into the "PricePulse" wordmark,
// so the icon reads as part of the word rather than a separate logo next to
// plain text. Distinct from Logo.jsx, which is the square app-icon version
// used for favicons/small tiles where a wide horizontal mark won't fit.
export default function Wordmark({ className = '', textClassName = 'text-xl', iconClassName = 'h-6' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 46 32" className={`${iconClassName} w-auto shrink-0`} aria-hidden="true">
        <circle cx="4" cy="20" r="3" fill="var(--brand)" />
        <path
          d="M4 20h8l4-11 5 20 6-24 4 15h9"
          stroke="var(--brand)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="42" cy="20" r="3" fill="var(--brand)" />
      </svg>
      <span className={`font-extrabold tracking-tight text-app ${textClassName}`}>
        Price<span className="text-brand">Pulse</span>
      </span>
    </span>
  );
}
