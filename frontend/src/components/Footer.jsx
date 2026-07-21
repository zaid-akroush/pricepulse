import { Link } from 'react-router-dom';
import Logo from './Logo';

const LINK_COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/search', label: 'Search Products' },
      { to: '/accessories', label: 'Accessories' },
      { to: '/events', label: 'Deals & Events' },
      { to: '/community', label: 'Community' },
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
      <div className="max-w-7xl mx-auto px-4 pt-14 pb-10">
        {/* Asymmetric layout: wide brand column, narrower link columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Logo className="w-7 h-7" />
              <span className="font-bold text-app text-lg tracking-tight">Price<span className="text-brand">Pulse</span></span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              Track electronics prices across the web and get notified the moment prices drop to your target. Free, no catch.
            </p>
          </div>

          {LINK_COLUMNS.map(col => (
            <div key={col.title}>
              <h4 className="text-app font-semibold mb-4 text-xs uppercase tracking-widest">{col.title}</h4>
              <div className="flex flex-col gap-2.5 text-sm">
                {col.links.map(l => (
                  <Link key={l.to} to={l.to} className="hover:text-brand transition-colors w-fit">{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="border-t border-app pt-6">
          <p className="text-xs leading-relaxed text-faint max-w-4xl">
            Product prices and availability are accurate as of the date and time indicated and are subject to change. Any price and availability information displayed on retailer websites at the time of purchase will apply to the purchase of the product. PricePulse is an independent price tracking service and is not affiliated with, endorsed by, or sponsored by any retailer. Price data is sourced from publicly available search results and may not reflect real-time availability.
          </p>
          <p className="text-xs text-faint mt-4">
            &copy; {new Date().getFullYear()} PricePulse. All rights reserved. <Link to="/privacy-policy" className="hover:text-brand transition-colors underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
