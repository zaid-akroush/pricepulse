import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FadeIn } from '../components/motion';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is PricePulse?',
        a: 'PricePulse is a price tracking tool for electronics. You can search for any product, add it to your wishlist, set a target price, and receive an email notification the moment the price drops to your target.',
      },
      {
        q: 'Is PricePulse free to use?',
        a: 'Yes, PricePulse is completely free. Create an account, start tracking products, and receive price drop alerts at no cost.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up Free" in the top navigation bar. Enter your name, email address, and a password. That\'s it, you\'re ready to start tracking.',
      },
    ],
  },
  {
    category: 'Tracking & Wishlist',
    items: [
      {
        q: 'How do I add a product to my wishlist?',
        a: 'Search for any product using the search bar. On the results page, enter an optional target price and click "Add to Wishlist". The product will appear in your Wishlist and we\'ll start tracking its price.',
      },
      {
        q: 'What is a target price?',
        a: 'A target price is the price you want to pay for a product. When the tracked price drops to or below your target, we send you an email alert. You can also add a product without a target price just to monitor it.',
      },
      {
        q: 'How often are prices checked?',
        a: 'Prices are checked every 6 hours automatically. You can also view the full price history chart on any product\'s detail page.',
      },
      {
        q: 'Can I update or remove my target price?',
        a: 'Yes. On your Wishlist page, each item has an "Edit" link next to the target price. You can update it at any time or clear it entirely.',
      },
      {
        q: 'Can I remove a product from my wishlist?',
        a: 'Yes. Click the "×" button on any wishlist item to remove it. Price history for that product is preserved in case other users are tracking it.',
      },
    ],
  },
  {
    category: 'Price Alerts',
    items: [
      {
        q: 'How do price drop email alerts work?',
        a: 'Once you set a target price, our system checks the product price every 6 hours. When the current price falls to or below your target, we send an email to your registered address with a direct link to the product.',
      },
      {
        q: 'I set a target price but haven\'t received an alert. Why?',
        a: 'The price may not have dropped to your target yet. You can check the current price and price history on the product detail page. Make sure the email address on your account is correct in your Profile settings.',
      },
      {
        q: 'Can I get alerts for multiple products?',
        a: 'Yes. You can add as many products as you like to your wishlist, each with its own target price. You\'ll receive a separate email for each product when its target is reached.',
      },
    ],
  },
  {
    category: 'Community',
    items: [
      {
        q: 'What is the Community page?',
        a: 'The Community page lets you browse what other users are tracking. You can see their wishlists, explore the "Most Expensive Wishlists" leaderboard, and find the best-value deals on currently tracked products.',
      },
      {
        q: 'Is my wishlist public?',
        a: 'Your wishlist items and name are visible on the Community page so others can discover deals. Your email address and target prices are always kept private.',
      },
    ],
  },
  {
    category: 'Technical',
    items: [
      {
        q: 'Where does the price data come from?',
        a: 'Search results are powered by Google Shopping via SerpApi, giving you real-time prices from all major retailers. Once a product is added to any wishlist, we store and periodically re-check its price to build a price history.',
      },
      {
        q: 'Why does the same product have different prices in search results vs my wishlist?',
        a: 'Search results show live prices from Google Shopping at that moment. Your wishlist stores the price at the time you added the product and updates it every 6 hours. Small differences are normal due to timing.',
      },
    ],
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-app last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-sm font-semibold text-app group-hover:text-brand transition-colors">{q}</span>
        <svg
          className={`w-4 h-4 text-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && <p className="text-sm text-muted leading-relaxed pb-4">{a}</p>}
    </div>
  );
}

export default function Help() {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? FAQS.map(cat => ({
        ...cat,
        items: cat.items.filter(
          i => i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)
    : FAQS;

  return (
    <div className="bg-app min-h-screen">
      {/* Hero */}
      <div className="bg-app-subtle border-b border-app py-16 px-4">
        <FadeIn className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">Support</p>
          <h1 className="text-4xl font-bold mb-3 tracking-tight text-app">Help Center</h1>
          <p className="text-muted mb-8">Everything you need to know about using PricePulse.</p>
          <div className="relative max-w-lg">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for answers"
              className="input pl-10"
            />
          </div>
        </FadeIn>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 flex gap-8 items-start">

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-faint">
              <p className="font-semibold mb-1">No results for "{search}"</p>
              <p className="text-sm">Try a different search term or browse the categories on the right.</p>
            </div>
          ) : filtered.map(cat => (
            <div key={cat.category} className="card px-6 py-2">
              <h2 className="text-xs font-bold text-brand uppercase tracking-widest py-4 border-b border-app">{cat.category}</h2>
              {cat.items.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
            </div>
          ))}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
          {/* Jump to section */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-4">Jump to Section</h3>
            <div className="space-y-1">
              {FAQS.map(cat => (
                <a
                  key={cat.category}
                  href={`#${cat.category}`}
                  onClick={e => { e.preventDefault(); setSearch(''); }}
                  className="block text-sm text-muted hover:text-brand font-medium py-1.5 px-3 rounded-xl hover:bg-brand-soft transition-colors"
                >
                  {cat.category}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-faint uppercase tracking-widest mb-3">Still need help?</h3>
            <p className="text-sm text-muted mb-4">Can't find an answer? Reach out and we'll get back to you.</p>
            <a
              href="mailto:support@pricepulse.app"
              className="block text-center text-sm font-bold bg-brand hover:opacity-90 text-on-brand py-2.5 rounded-xl transition-opacity"
            >
              Contact Support
            </a>
          </div>

          {/* Quick actions */}
          <div className="bg-brand rounded-2xl p-5 text-on-brand">
            <p className="font-bold mb-3">Ready to start?</p>
            <div className="flex flex-col gap-2">
              <Link to="/search" className="text-sm font-semibold bg-[var(--on-brand)] text-brand-strong text-center py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                Search Products
              </Link>
              <Link to="/register" className="text-sm font-semibold bg-black/10 hover:bg-black/20 text-center py-2.5 rounded-xl transition-colors">
                Create Account
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
