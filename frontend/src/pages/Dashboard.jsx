import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProductImage from '../components/ProductImage';
import PageHeader from '../components/PageHeader';
import PriceChart from '../components/PriceChart';
import Price from '../components/Price';
import { useCurrency } from '../context/CurrencyContext';
import { Stagger, StaggerItem } from '../components/motion';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className={`text-2xl font-bold font-data mt-1 ${accent || ''}`} style={accent ? {} : { color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function csvDownload(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { convert, displayCurrency } = useCurrency();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    api.get('/wishlist/analytics')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [user]);

  function exportWishlist() {
    const rows = [['Product', 'Currency', 'Current', 'Lowest', 'Highest', 'Target', 'Saved vs Peak', 'Drop %', 'Deal Score']];
    data.items.forEach(d => rows.push([
      d.title, d.currency, d.currentPrice, d.lowestPrice, d.highestPrice,
      d.targetPrice ?? '', d.savedVsPeak, d.dropPercent, d.dealScore,
    ]));
    csvDownload('pricepulse_wishlist.csv', rows);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  if (!data || data.totalTracked === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
            <path d="M3 3v18h18" /><path d="M7 15l4-6 3 4 5-8" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Your dashboard is waiting</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Track a few products and your savings analytics will show up here.
        </p>
        <Link to="/search" className="btn-primary">Search Products &rarr;</Link>
      </div>
    );
  }

  // Aggregate totals convert PER ITEM before summing, so this stays correct
  // even when items are tracked in different currencies (data.items[0]'s
  // currency alone used to be applied to the whole aggregate, which was
  // wrong the moment two items didn't share a currency).
  const totalSavedVsPeak = data.items.reduce((sum, d) => sum + convert(d.savedVsPeak, d.currency).amount, 0);
  const totalCurrentValue = data.items.reduce((sum, d) => sum + convert(d.currentPrice, d.currency).amount, 0);
  const maxSaved = Math.max(...data.items.map(d => d.savedVsPeak), 1);
  const topSavers = [...data.items].sort((a, b) => b.savedVsPeak - a.savedVsPeak).slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        subtitle="Your price-tracking performance at a glance"
        action={<button onClick={exportWishlist} className="btn-secondary text-sm">&darr; Export CSV</button>}
        className="mb-8"
      />

      {/* Stat cards */}
      <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" stagger={0.05}>
        <StaggerItem><StatCard label="Products Tracked" value={data.totalTracked} sub={`${data.alertsSet} with alerts`} /></StaggerItem>
        <StaggerItem><StatCard label="Saved vs Peak" value={<Price amount={totalSavedVsPeak} currency={displayCurrency} />} accent="text-success" sub="across your wishlist" /></StaggerItem>
        <StaggerItem><StatCard label="Alerts Triggered" value={data.targetsHit} sub={`${data.targetsMet} targets met now`} accent="text-brand" /></StaggerItem>
        <StaggerItem><StatCard label="Avg Deal Score" value={`${data.avgDealScore}/100`} sub="0 = peak, 100 = lowest" /></StaggerItem>
      </Stagger>

      {/* Tracked value + biggest drop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total Tracked Value</p>
          <p className="text-2xl font-bold font-data mt-1" style={{ color: 'var(--text)' }}><Price amount={totalCurrentValue} currency={displayCurrency} /></p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sum of current prices of all tracked items</p>
        </div>
        {data.biggestDrop && (
          <Link to={`/product/${data.biggestDrop.productId}`} className="card p-5 flex items-center gap-4 hover:border-brand transition-colors">
            <div className="w-14 h-14 rounded-xl overflow-hidden surface-3 shrink-0">
              <ProductImage src={data.biggestDrop.imageUrl} alt={data.biggestDrop.title} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Biggest Drop</p>
              <p className="text-sm font-bold line-clamp-1" style={{ color: 'var(--text)' }}>{data.biggestDrop.title}</p>
              <p className="text-success font-bold font-data text-lg">{data.biggestDrop.dropPercent}% off peak</p>
            </div>
          </Link>
        )}
      </div>

      {/* Savings bar chart */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>Top Savings vs Peak Price</h2>
        <div className="space-y-3">
          {topSavers.map(d => (
            <Link key={d.id} to={`/product/${d.productId}`} className="block group">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium line-clamp-1 pr-3 group-hover:text-brand" style={{ color: 'var(--text)' }}>{d.title}</span>
                <span className="font-bold font-data shrink-0 text-success"><Price amount={d.savedVsPeak} currency={d.currency} /></span>
              </div>
              <div className="h-2.5 rounded-r-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="h-full rounded-r-full bg-success"
                  style={{ width: `${Math.max(4, (d.savedVsPeak / maxSaved) * 100)}%` }} />
              </div>
            </Link>
          ))}
        </div>
        {topSavers.every(d => d.savedVsPeak === 0) && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No savings recorded yet. They appear once prices drop from their peak.
          </p>
        )}
      </div>

      {/* Per-item price history charts */}
      <div className="mt-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>Price History</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topSavers.map(d => (
            <div key={d.id} className="card p-5">
              <Link to={`/product/${d.productId}`} className="flex items-center gap-3 mb-3 group">
                <div className="w-10 h-10 rounded-lg overflow-hidden surface-3 shrink-0">
                  <ProductImage src={d.imageUrl} alt={d.title} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold line-clamp-1 group-hover:text-brand transition-colors" style={{ color: 'var(--text)' }}>{d.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Price amount={d.currentPrice} currency={d.currency} />
                    {d.savedVsPeak > 0 && <span className="text-success font-semibold"> · saved <Price amount={d.savedVsPeak} currency={d.currency} /> vs peak</span>}
                  </p>
                </div>
              </Link>
              <PriceChart history={d.priceHistory} currency={d.currency} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
