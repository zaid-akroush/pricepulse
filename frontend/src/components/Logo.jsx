export default function Logo({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path
        d="M6 34h10l6-16 6 30 8-36 6 22h16"
        stroke="var(--on-brand)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
