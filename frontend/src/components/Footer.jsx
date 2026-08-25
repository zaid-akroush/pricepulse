import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

const LINK_COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/search', label: 'Search Products' },
      { to: '/events', label: 'Deals & Events' },
      { to: '/wishlist?tab=following', label: 'Following' },
    ],
  },
  {
    title: 'Categories',
    links: [
      { to: '/search?q=smartphone', label: 'Smartphones' },
      { to: '/search?q=laptop', label: 'Laptops' },
      { to: '/search?q=headphones', label: 'Headphones' },
      { to: '/search?q=4K%20TV', label: 'TVs' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/wishlist', label: 'My Wishlist' },
      { to: '/register', label: 'Create Account' },
      { to: '/help', label: 'Help Center' },
      { to: '/privacy-policy', label: 'Privacy Policy' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-app-subtle border-t border-app text-muted mt-auto">
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        {/* Brand on the left, link columns grouped on the right. The brand
            column is capped in width, so with only two link columns the row
            left a wide band of nothing in the middle — a third column of
            category shortcuts both fills it and is useful. */}
        <div className="flex flex-col lg:flex-row lg:justify-between gap-6 mb-6">
          <div className="lg:max-w-sm">
            <div className="mb-2.5">
              <Wordmark textClassName="text-lg" iconClassName="h-5" />
            </div>
            <p className="text-sm leading-relaxed">
              Track electronics prices across the web and get notified the moment prices drop to your target. Free, no catch.
            </p>
          </div>

          {/* Product + Account grouped into one bordered box, with a divider
              between the two columns instead of just a bare gap. */}
          <div className="card p-4 flex flex-col sm:flex-row gap-4 sm:gap-0 shrink-0">
            {LINK_COLUMNS.map((col, i) => (
              <div key={col.title} className={`sm:px-6 ${i > 0 ? 'sm:border-l border-app' : 'sm:pl-0'}`}>
                <h4 className="text-app font-semibold mb-2.5 text-xs uppercase tracking-widest">{col.title}</h4>
                <div className="flex flex-col gap-2 text-sm">
                  {col.links.map(l => (
                    <Link key={l.to} to={l.to} className="hover:text-brand transition-colors w-fit">{l.label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer — spans the full width of the footer row */}
        <div className="border-t border-app pt-4">
          <p className="text-xs leading-relaxed text-faint">
            Product prices and availability are accurate as of the date and time indicated and are subject to change. Any price and availability information displayed on retailer websites at the time of purchase will apply to the purchase of the product. PricePulse is an independent price tracking service and is not affiliated with, endorsed by, or sponsored by any retailer. Price data is sourced from publicly available search results and may not reflect real-time availability.
          </p>
          <p className="text-xs text-faint mt-3">
            &copy; {new Date().getFullYear()} PricePulse. All rights reserved. <Link to="/privacy-policy" className="hover:text-brand transition-colors underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
