import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Short "how this works" walkthrough shown once to first-time visitors,
// gated on a localStorage flag rather than an account field so it also
// works for people browsing before they've signed up.
const STEPS = [
  {
    title: 'Search any electronics product',
    body: 'Type a product name into Search, we pull live prices from Google Shopping across all major retailers.',
  },
  {
    title: 'Track it and set a target price',
    body: 'Add a product to your Wishlist with an optional target price. We check the price every 6 hours automatically.',
  },
  {
    title: 'Get alerted the moment it drops',
    body: "When the price hits your target, you'll get an email right away, no need to keep checking back.",
  },
];

export default function TutorialModal() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem('pp_tutorial_seen')) setOpen(true);
    } catch { /* localStorage unavailable, skip the tutorial silently */ }
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem('pp_tutorial_seen', 'true'); } catch {}
  }

  if (!open) return null;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={close}>
      <div className="card max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <p className="eyebrow mb-2">Welcome to PricePulse</p>
        <h2 className="text-xl font-bold text-app mb-2">{STEPS[step].title}</h2>
        <p className="text-sm text-muted mb-6">{STEPS[step].body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-app-subtle'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={close} className="btn-ghost text-sm flex-1">Skip</button>
          <button
            onClick={() => isLast ? (close(), navigate('/search')) : setStep(s => s + 1)}
            className="btn-primary text-sm flex-1"
          >
            {isLast ? 'Start Searching' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
