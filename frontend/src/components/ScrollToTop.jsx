import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router doesn't reset scroll position on navigation the way a
// full page load would — without this, clicking a nav link while
// scrolled down on the previous page leaves you scrolled down on the
// new one too. Watches the pathname (not the full location, so query
// string changes like /search?q=... don't yank scroll back to top) and
// jumps to top on every route change.
//
// Uses useLayoutEffect (not useEffect) so the scroll reset happens
// synchronously before the browser paints the new page. With useEffect,
// the new page briefly renders one frame at the OLD scroll position —
// which means any whileInView/FadeIn/Stagger animations on that page
// evaluate visibility against the wrong viewport, play or skip
// incorrectly, and then the page snaps to top a moment later. That
// snap-then-animate is the "glitch" when switching sections/tabs while
// scrolled down.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
