import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useCurrency, SUPPORTED_CURRENCIES } from '../context/CurrencyContext';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import Wordmark from './Wordmark';

const LINKS = [
  { to: '/search', label: 'Search' },
  { to: '/events', label: 'Deals' },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'grey', label: 'Dark' },
  { value: 'amoled', label: 'AMOLED' },
];

// Sun / full moon / crescent ("almost gone") moon icons for the three theme
// states, so the toggle button itself always shows the CURRENT theme, and
// the popout menu below it lists all three by name.
function ThemeIcon({ theme, className = 'w-4 h-4' }) {
  if (theme === 'light') {
    return (
      <svg className={`${className} text-warning`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
      </svg>
    );
  }
  if (theme === 'grey') {
    // Full moon
    return (
      <svg className={`${className} text-muted`} viewBox="0 0 20 20" fill="currentColor">
        <circle cx="10" cy="10" r="7" />
      </svg>
    );
  }
  // AMOLED: crescent ("almost gone") moon
  return (
    <svg className={`${className} text-muted`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M15.5 13.5A7 7 0 018 3.06 7 7 0 1015.5 13.5z" />
    </svg>
  );
}

function ThemeMenu({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-lg border border-app hover:bg-app-subtle flex items-center justify-center transition-colors active:scale-95"
        title="Change theme"
        aria-label="Change theme"
        aria-expanded={open}
      >
        <ThemeIcon theme={theme} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-40 card p-1.5 shadow-float">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  theme === opt.value ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-app-subtle hover:text-app'
                }`}
              >
                <ThemeIcon theme={opt.value} className="w-4 h-4 shrink-0" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Popout listing every supported display currency — same interaction
// pattern as ThemeMenu, so switching currency feels consistent with theme.
function CurrencyMenu() {
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const current = SUPPORTED_CURRENCIES.find(c => c.code === displayCurrency) || SUPPORTED_CURRENCIES[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 px-2.5 rounded-lg border border-app hover:bg-app-subtle flex items-center gap-1 text-xs font-bold text-muted transition-colors active:scale-95"
        title="Change display currency"
        aria-label="Change display currency"
        aria-expanded={open}
      >
        {current.code}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-48 card p-1.5 shadow-float max-h-72 overflow-y-auto">
            {SUPPORTED_CURRENCIES.map(c => (
              <button
                key={c.code}
                onClick={() => { setDisplayCurrency(c.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  displayCurrency === c.code ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-app-subtle hover:text-app'
                }`}
              >
                <span className="w-6 text-center font-bold shrink-0">{c.symbol}</span>
                <span className="flex-1 text-left truncate">{c.label}</span>
                <span className="text-[10px] text-faint shrink-0">{c.code}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get('/social/notifications/unread-count')
      .then(r => setUnread(r.data.count))
      .catch(() => {});
  }, [user, location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  const isActive = (path) => location.pathname === path;

  // Wishlist/Analytics/Saved are always shown in the nav, even when logged
  // out — clicking one routes through PrivateRoute, which sends anonymous
  // visitors to /login. Admin stays role-gated since it's not a general
  // user feature.
  const userLinks = [
    { to: '/wishlist', label: 'Wishlist' },
    { to: '/saved-searches', label: 'Saved' },
    user?.isAdmin && { to: '/admin', label: 'Admin' },
  ].filter(Boolean);

  // Help always sits last in the nav, it's a fallback/reference destination
  // rather than a core feature, so it shouldn't compete for the prime spots.
  const allLinks = [...LINKS, ...userLinks, { to: '/help', label: 'Help' }];

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'surface-translucent backdrop-blur-md border-b border-app shadow-[var(--shadow-sm)]' : 'surface border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0">
          <Wordmark />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-0.5">
          {allLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.to) ? 'text-brand' : 'text-muted hover:text-app'
              }`}
            >
              {isActive(link.to) && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 bg-brand-soft rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth + theme */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <ThemeMenu theme={theme} setTheme={setTheme} />
          <CurrencyMenu />

          {user ? (
            <>
              <Link to="/notifications" className="relative w-9 h-9 rounded-lg border border-app hover:bg-app-subtle flex items-center justify-center transition-colors" title="Notifications" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand text-on-brand text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>

              <Link to="/profile" className="flex items-center gap-2 text-sm text-app pl-1">
                <span className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold shrink-0">
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="hidden xl:inline">Hi, {user.name.split(' ')[0]}</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost text-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted hover:text-app transition-colors px-3 py-2">
                Login
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Sign Up Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="lg:hidden flex items-center gap-2">
          <ThemeMenu theme={theme} setTheme={setTheme} />
          <CurrencyMenu />
          {user && (
            <Link to="/notifications" className="relative w-8 h-8 rounded-lg border border-app flex items-center justify-center shrink-0" title="Notifications" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand text-on-brand text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
          {user && (
            <button onClick={handleLogout} className="w-8 h-8 rounded-lg border border-app flex items-center justify-center text-danger shrink-0" title="Logout" aria-label="Logout">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          {user && (
            <Link to="/profile" className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-on-brand text-xs font-bold shrink-0" title="Profile" aria-label="Profile">
              {user.name[0]?.toUpperCase()}
            </Link>
          )}
          <button
            className="text-app w-8 h-8 flex items-center justify-center"
            onClick={() => setMenuOpen(!menuOpen)}
            title={menuOpen ? 'Close menu' : 'Open menu'}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden surface border-t border-app overflow-hidden"
          >
            <div className="px-4 py-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
              {allLinks.map(l => (
                <Link key={l.to} to={l.to} className={`text-sm py-1 truncate ${isActive(l.to) ? 'text-brand font-semibold' : 'text-app'}`}>{l.label}</Link>
              ))}
              {!user && (
                <>
                  <Link to="/login" className="text-sm text-app py-1 truncate">Login</Link>
                  <Link to="/register" className="text-sm text-brand font-semibold py-1 truncate">Sign Up Free</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
