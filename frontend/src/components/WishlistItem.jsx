import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import PriceChart from './PriceChart';
import ProductImage from './ProductImage';
import Price from './Price';
import { useCurrency } from '../context/CurrencyContext';
import { spring } from './motion';

export default function WishlistItem({ item, onRemove, onUpdate }) {
  const { product } = item;
  const { convert } = useCurrency();
  const [editing, setEditing] = useState(false);
  const [targetPrice, setTargetPrice] = useState(item.targetPrice ?? '');
  const [targetDropPercent, setTargetDropPercent] = useState(item.targetDropPercent ?? '');
  const [loading, setLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const history = product.priceHistory || [];
  const prev = history.length >= 2 ? history[history.length - 2]?.price : null;
  const rawChange = prev !== null ? product.currentPrice - prev : null;
  // Round to cents and treat sub-cent float noise as "no change" so we don't
  // show a "▲ 0.00" badge when nothing actually moved.
  const priceChange = rawChange !== null ? Math.round(rawChange * 100) / 100 : null;
  const dropPercent = product.highestPrice > 0
    ? Math.round(((product.highestPrice - product.currentPrice) / product.highestPrice) * 100)
    : 0;

  let retailer = null;
  try { retailer = product.url ? new URL(product.url).hostname.replace(/^www\./, '') : null; } catch { retailer = null; }

  async function handleUpdate() {
    setLoading(true);
    try {
      const res = await api.patch(`/wishlist/${item.id}`, {
        targetPrice: targetPrice !== '' ? parseFloat(targetPrice) : null,
        targetDropPercent: targetDropPercent !== '' ? parseFloat(targetDropPercent) : null,
      });
      onUpdate(res.data);
      setEditing(false);
    } finally { setLoading(false); }
  }

  async function handleRemove() {
    if (!confirm('Remove from wishlist?')) return;
    await api.delete(`/wishlist/${item.id}`);
    onRemove(item.id);
  }

  async function handleRefresh() {
    setRefreshing(true); setRefreshMsg('');
    try {
      const { data } = await api.post(`/products/${product.id}/refresh`);
      if (data.updated) {
        onUpdate({ ...item, product: data.product });
        setRefreshMsg('Price updated!');
      } else {
        setRefreshMsg(data.message || 'No live price available right now.');
      }
    } catch {
      setRefreshMsg('Could not refresh right now.');
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(''), 3000);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex gap-4">
        {/* Image */}
        <div className="w-24 h-24 rounded-xl surface-2 shrink-0 overflow-hidden flex items-center justify-center p-1.5">
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            productId={product.id}
            className="w-full h-full object-contain"
            fallbackClass="w-full h-full"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/product/${product.id}`} className="text-sm font-semibold text-app hover:text-brand transition-colors line-clamp-2">
              {product.title}
            </Link>
            <button onClick={handleRemove} className="text-faint hover:text-danger text-xl shrink-0 leading-none" title="Remove from wishlist" aria-label="Remove from wishlist">×</button>
          </div>

          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl price-tag"><Price amount={product.currentPrice} currency={product.currency} /></span>
            {priceChange !== null && priceChange !== 0 && (
              <span className={`text-xs font-bold font-data ${priceChange < 0 ? 'text-success' : 'text-danger'}`}>
                {priceChange < 0 ? '▼' : '▲'} {Math.abs(convert(priceChange, product.currency).amount).toFixed(2)}
              </span>
            )}
            {dropPercent > 0 && (
              <span className="badge badge-green">{dropPercent}% below peak</span>
            )}
          </div>

          {product.url && (
            <a href={product.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-on-brand bg-brand hover:opacity-90 px-2.5 py-1 rounded-lg transition-opacity">
              Buy for <Price amount={product.currentPrice} currency={product.currency} />{retailer ? ` at ${retailer}` : ''} &rarr;
            </a>
          )}

          <div className="flex gap-4 mt-1.5 text-xs text-muted">
            <span>Low: <strong className="text-success font-data"><Price amount={product.lowestPrice} currency={product.currency} /></strong></span>
            <span>High: <strong className="text-danger font-data"><Price amount={product.highestPrice} currency={product.currency} /></strong></span>
          </div>

          {/* Target price */}
          {editing ? (
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex gap-2">
                <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                  placeholder="Target price (USD)" className="input text-xs py-1.5 flex-1" />
                <input type="number" value={targetDropPercent} onChange={e => setTargetDropPercent(e.target.value)}
                  placeholder="% drop alert (e.g. 20)" min="1" max="99"
                  className="input text-xs py-1.5 w-36" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleUpdate} disabled={loading}
                  className="text-xs bg-brand text-on-brand px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">Save</button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted hover:text-app transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Target: <span className="font-medium">{item.targetPrice ? <Price amount={item.targetPrice} currency={product.currency} /> : 'Not set'}</span></span>
              {item.targetDropPercent && (
                <span>Drop alert: <span className="font-medium text-brand">{item.targetDropPercent}% off peak</span></span>
              )}
              <button onClick={() => setEditing(true)} className="text-brand hover:text-[var(--brand-strong)] hover:underline transition-colors">Edit</button>
            </div>
          )}
        </div>
      </div>

      {/* Chart toggle */}
      <div className="border-t border-app px-4 py-2 flex items-center justify-between surface-2">
        <button onClick={() => setShowChart(!showChart)}
          className="text-xs text-muted hover:text-brand font-medium flex items-center gap-1 transition-colors"
          aria-expanded={showChart}>
          <motion.span animate={{ rotate: showChart ? 180 : 0 }} transition={spring} className="inline-block">▼</motion.span>
          <span>{showChart ? 'Hide' : 'Show'} Price History</span>
        </button>
        <div className="flex items-center gap-3">
          {refreshMsg && <span className="text-xs font-medium text-success">{refreshMsg}</span>}
          <button onClick={handleRefresh} disabled={refreshing}
            className="text-xs text-muted hover:text-brand font-medium disabled:opacity-50 transition-colors">
            {refreshing ? 'Checking…' : '↻ Check price now'}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showChart && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2">
              <PriceChart history={history} currency={product.currency} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
