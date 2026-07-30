import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't reset scroll position on navigation the way a
// full page load would — without this, clicking a nav link while
// scrolled down on the previous page leaves you scrolled down on the
// new one too. Watches the pathname (not the full location, so query
// string changes like /search?q=... don't yank scroll back to top) and
// jumps to top on every route change.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
