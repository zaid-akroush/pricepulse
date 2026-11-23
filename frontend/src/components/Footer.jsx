import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Wordmark from './Wordmark';

const LINK_COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/search', label: 'Search Products' },
      { to: '/trends', label: 'Price Trends' },
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
      { to: '/privacy-policy', label: 'Privacy Policy' },
    ],
  },
];

export default function Footer() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/products/public-stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <footer className="bg-app-subtle border-t border-app text-muted mt-auto">
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        {/* Brand | how it works | links, then the live counts in one row. */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr_auto] mb-8">
          <div>
            <div className="mb-2.5">
              <Wordmark textClassName="text-lg" iconClassName="h-5" />
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Tracks electronics prices on Google Shopping and emails you when one reaches your target.
            </p>
          </div>

          <div>
            <h4 className="text-app font-semibold mb-2.5 text-xs uppercase tracking-widest">How it works</h4>
            <ol className="text-sm leading-relaxed space-y-1.5">
              {[
                'Search in your country. Prices come in its currency.',
                'Add a product with a target price or a percentage drop.',
                'Prices are re-checked every 3 to 48 hours. When yours is hit, you get an email and an in-app alert.',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-app font-semibold w-3 shrink-0">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-4 flex flex-col sm:flex-row gap-4 sm:gap-0 lg:self-start">
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

        {/* Real aggregate counts; hidden until there is something to show. */}
        {stats?.productsTracked > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 border-t border-app pt-5 mb-6">
            {[
              [stats.productsTracked, 'products tracked'],
              [stats.activeTrackers, 'people tracking'],
              [stats.priceChecks, 'prices recorded'],
              [stats.dropsRecorded, 'below their peak'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-xl font-bold text-app leading-none">{value?.toLocaleString?.() ?? value}</p>
                <p className="text-xs mt-1.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer — spans the full width of the footer row */}
        <div className="border-t border-app pt-4">
          <p className="text-xs leading-relaxed text-faint">
            Product prices and availability are accurate as of the date and time indicated and are subject to change. Any price and availability information displayed on retailer websites at the time of purchase will apply to the purchase of the product. PricePulse is an independent price tracking service and is not affiliated with, endorsed by, or sponsored by any retailer. Price data is sourced from publicly available search results and may not reflect real-time availability.
          </p>
          <p className="text-xs text-faint mt-3">
            &copy; {new Date().getFullYear()} PricePulse. All rights reserved. <Link to="/privacy-policy" className="hover:text-brand transition-colors underline">Privacy Policy</Link>
          </p>
        </div>

        {/* Author credit — the last line on every page, below everything else. */}
        <div className="border-t border-app mt-4 pt-4">
          <p className="text-xs text-center text-faint">
            Made by Zaid Akroush
          </p>
        </div>
      </div>
    </footer>
  );
}
