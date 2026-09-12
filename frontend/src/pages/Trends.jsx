import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import Price from '../components/Price';
import ProductImage from '../components/ProductImage';
import Sparkline from '../components/Sparkline';
import { describeApiError } from '../api/errorMessage';

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function Stat({ label, value, tone }) {
  const color = tone === 'down' ? 'text-success' : tone === 'up' ? 'text-danger' : 'text-app';
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold text-faint uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold font-data mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function TrendRow({ item, showChange = true }) {
  const down = item.changePct < 0;
  return (
    <Link to={`/product/${item.id}`} className="card card-hover p-3 flex items-center gap-3 min-w-0">
      <ProductImage src={item.imageUrl} alt="" productId={item.id}
        wrapperClass="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white" className="w-full h-full object-contain" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app truncate">{item.title}</p>
        <p className="text-xs text-faint mt-0.5">
          <Price amount={item.currentPrice} currency={item.currency} className="text-app font-data" />
          {showChange && (
            <>
              <span className="mx-1">from</span>
              <Price amount={item.startPrice} currency={item.currency} className="font-data" />
            </>
          )}
          {item.trackers > 0 && <span className="ml-2">{item.trackers} tracking</span>}
        </p>
      </div>
      <Sparkline points={item.sparkline} className="shrink-0 hidden sm:block" />
      {showChange ? (
        <span className={`badge shrink-0 ${down ? 'badge-green' : 'badge-red'}`}>
          {down ? '' : '+'}{item.changePct}%
        </span>
      ) : (
        <span className="badge badge-green shrink-0">Lowest ever</span>
      )}
    </Link>
  );
}

function Section({ title, subtitle, items, empty, showChange }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-app">{title}</h2>
      {subtitle && <p className="text-xs text-muted mb-3">{subtitle}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-faint card p-4">{empty}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(it => <TrendRow key={it.id} item={it} showChange={showChange} />)}
        </div>
      )}
    </section>
  );
}

export default function Trends() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api.get('/products/trends', { params: { days } })
      .then(r => { if (alive) setData(r.data); })
      .catch(err => { if (alive) setError(describeApiError(err, 'Could not load trends.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const s = data?.summary;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        eyebrow="Market"
        title="Price Trends"
        subtitle="What the products tracked on PricePulse have been doing, computed from every price observation we record. No account needed."
        className="mb-6"
        action={(
          <div className="flex gap-2">
            {WINDOWS.map(w => (
              <button key={w.days} onClick={() => setDays(w.days)}
                className={`chip ${days === w.days ? 'chip-active' : ''}`}>{w.label}</button>
            ))}
          </div>
        )}
      />

      {error && <p className="text-sm text-danger card p-4 mb-6">{error}</p>}

      {loading && !data && (
        <div className="grid gap-3 sm:grid-cols-4 mb-8">
          {[0, 1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse" />)}
        </div>
      )}

      {s && (
        <div className={`grid gap-3 grid-cols-2 sm:grid-cols-4 mb-8 ${loading ? 'opacity-60' : ''}`}>
          <Stat label="Products observed" value={s.productsObserved} />
          <Stat label="Got cheaper" value={s.fell} tone="down" />
          <Stat label="Got dearer" value={s.rose} tone="up" />
          <Stat label="Average change" value={`${s.averageChangePct > 0 ? '+' : ''}${s.averageChangePct}%`}
            tone={s.averageChangePct < 0 ? 'down' : s.averageChangePct > 0 ? 'up' : undefined} />
        </div>
      )}

      {data && (
        <>
          <Section title="Biggest drops" subtitle={`Largest price decrease over the last ${days} days.`}
            items={data.biggestDrops} empty="No product fell in price in this window yet. Check back after the next price sweep." showChange />
          <Section title="At their lowest price ever" subtitle="Currently at the cheapest price we have ever recorded for them."
            items={data.atAllTimeLow} empty="Nothing is sitting at its all-time low right now." showChange={false} />
          <Section title="Most volatile" subtitle="Largest single move between two consecutive checks. Good candidates for a target price."
            items={data.mostVolatile} empty="No price moved in this window." showChange />
          <Section title="Biggest rises" subtitle="If you were waiting on one of these, the window may have closed."
            items={data.biggestRises} empty="Nothing got more expensive in this window." showChange />
          <p className="text-xs text-faint">
            Based on {s.observations} price observations across {s.productsObserved} products. Products are
            re-checked between every 3 and 48 hours depending on how much their price moves and how many people track them.
          </p>
        </>
      )}
    </div>
  );
}
