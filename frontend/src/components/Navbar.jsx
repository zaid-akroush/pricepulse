import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import Logo from './Logo';

const LINKS = [
  { to: '/search', label: 'Search' },
  { to: '/accessories', label: 'Accessories' },
  { to: '/community', label: 'Community' },
  { to: '/events', label: 'Deals' },
  { to: '/help', label: 'Help' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();
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
    { to: '/dashboard', label: 'Analytics' },
    { to: '/saved-searches', label: 'Saved' },
    user?.isAdmin && { to: '/admin', label: 'Admin' },
  ].filter(Boolean);

  const allLinks = [...LINKS, ...userLinks];

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'surface/90 backdrop-blur-md border-b border-app shadow-sm' : 'surface border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo />
          <span className="font-bold text-xl tracking-tight text-app">
            Price<span className="text-brand">Pulse</span>
          </span>
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

        {/* Auth + dark toggle */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-lg border border-app hover:bg-app-subtle flex items-center justify-center transition-colors active:scale-95"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

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
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg border border-app flex items-center justify-center transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
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
            <div className="px-4 py-3 flex flex-col gap-1">
              {allLinks.map(l => (
                <Link key={l.to} to={l.to} className={`text-sm py-2 ${isActive(l.to) ? 'text-brand font-semibold' : 'text-app'}`}>{l.label}</Link>
              ))}
              {user && <Link to="/notifications" className="text-sm text-app py-2">
                Notifications {unread > 0 && <span className="ml-1 bg-brand text-on-brand text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>}
              </Link>}
              {user ? (
                <>
                  <Link to="/profile" className="text-sm text-app py-2">Profile</Link>
                  <button onClick={handleLogout} className="text-sm text-danger text-left py-2">Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-app py-2">Login</Link>
                  <Link to="/register" className="text-sm text-brand font-semibold py-2">Sign Up Free</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
