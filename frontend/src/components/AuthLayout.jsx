import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { spring } from './motion';
import Logo from './Logo';

const FEATURES = [
  'Real-time prices from every major retailer',
  'Set a target price, we watch it for you',
  'Email the second a price drops',
];

/* Shared split-screen layout for Login / Register / Forgot / Reset. Replaces
   the old centered-card pattern (banned by the design brief) with an
   asymmetric layout: brand panel + form panel. */
export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="min-h-[calc(100dvh-64px)] grid grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative flex-col justify-between bg-ink text-white px-14 py-14 overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <Logo className="w-8 h-8" />
          <span className="font-bold text-xl tracking-tight">Price<span className="text-brand">Pulse</span></span>
        </Link>

        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold leading-tight tracking-tight mb-6">
            Shop smarter. Never pay peak price again.
          </h2>
          <div className="flex flex-col gap-3.5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: 0.1 + i * 0.1 }}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <span className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                {f}
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">Free to use. No card required.</p>

        {/* decorative floating price chip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.5 }}
          className="animate-float absolute bottom-24 right-10 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm"
        >
          <p className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Price dropped</p>
          <p className="text-lg font-bold font-data text-white">-24%</p>
        </motion.div>

        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brand/10 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="w-9 h-9" />
              <span className="font-bold text-xl tracking-tight text-app">Price<span className="text-brand">Pulse</span></span>
            </Link>
          </div>

          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="text-3xl font-bold text-app tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted text-sm mt-1.5 mb-8">{subtitle}</p>}
          {!subtitle && <div className="mb-8" />}

          {children}

          {footer && <div className="text-center text-sm text-muted mt-6">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}
