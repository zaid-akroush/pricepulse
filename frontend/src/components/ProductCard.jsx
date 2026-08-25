import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProductImage from './ProductImage';
import Price from './Price';
import { detectBrand, brandLogoUrl } from '../utils/brand';
import { getRepairabilityGrade, getEuEnergyGrade, repairabilityTier, euEnergyTier } from './ProductSpecs';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [navigating, setNavigating] = useState(false);

  // Persist the clicked product (if new) and open its in-app detail page.
  async function openDetail() {
    if (navigating) return;
    setNavigating(true);
    try {
      const { data } = await api.post('/products/from-search', {
        title: product.title, url: product.url, imageUrl: product.imageUrl,
        price: product.price, currency: product.currency, serpApiQuery: product.serpApiQuery,
      });
      navigate(`/product/${data.id}`);
    } catch {
      if (product.url) window.open(product.url, '_blank'); // fallback to store
    } finally { setNavigating(false); }
  }

  async function handleAdd(e) {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    setLoading(true); setError(null);
    try {
      await api.post('/wishlist', {
        title: product.title, url: product.url, imageUrl: product.imageUrl,
        currentPrice: product.price, currency: product.currency,
        serpApiQuery: product.serpApiQuery,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      });
      setAdded(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add');
    } finally { setLoading(false); }
  }

  const discount = product.originalPrice && product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  const brand = detectBrand(product.title);
  const repairability = getRepairabilityGrade(product.title);
  const euEnergy = getEuEnergyGrade(product.title);

  return (
    <div className="card card-hover flex flex-col overflow-hidden group cursor-pointer relative" onClick={openDetail}>
      {navigating && (
        <div className="absolute inset-0 z-20 surface flex items-center justify-center">
          <span className="text-xs font-semibold text-brand">Loading details</span>
        </div>
      )}
      {/* Image */}
      <div className="relative surface-2 overflow-hidden rounded-t-2xl" style={{ paddingBottom: '100%' }}>
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-contain group-hover:scale-[1.07] transition-transform duration-300"
            wrapperClass="w-full h-full"
          />
        </div>
        {discount && discount > 0 && (
          <div className="absolute top-2.5 left-2.5 badge badge-solid shadow-[var(--shadow-sm)]">-{discount}%</div>
        )}
        {product.stale && (
          <div className="absolute bottom-2.5 left-2.5 badge bg-black/70 text-white text-[10px]">Cached price</div>
        )}
        {product.source && (
          <div className="absolute top-2.5 right-2.5 badge bg-black/70 text-white text-[10px]">{product.source}</div>
        )}
        {/* Not on sale yet (pre-order / future model year). Called out on the
            card itself so an unreleased item is never mistaken for a price
            you can act on today. */}
        {product.released === false && (
          <div className="absolute top-2.5 left-2.5 badge badge-orange text-[10px]">
            {product.releaseLabel || 'Not released yet'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start gap-2 min-h-[2.5rem]">
          {brand && (
            <img
              src={brandLogoUrl(brand.slug)}
              alt={brand.name}
              className="w-4 h-4 mt-0.5 shrink-0 object-contain"
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <h3 className="text-sm font-semibold text-app line-clamp-2 leading-snug">{product.title}</h3>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl price-tag">
            {product.price != null ? <Price amount={product.price} currency={product.currency} /> : 'N/A'}
          </span>
          {product.rating && (
            <span className="text-xs text-warning font-semibold">
              ★ {product.rating}{product.reviews ? <span className="text-faint font-normal"> ({product.reviews.toLocaleString()})</span> : null}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`badge badge-${repairabilityTier(repairability)} !text-[10px]`} title="Repairability score (iFixit, 0-10)">
            Repair: {repairability != null ? `${repairability}/10` : 'N/A'}
          </span>
          <span className={`badge badge-${euEnergyTier(euEnergy)} !text-[10px]`} title="EU energy efficiency class (A-G)">
            EU Energy: {euEnergy || 'N/A'}
          </span>
        </div>

        {!added ? (
          <div className="flex flex-col gap-2 mt-2" onClick={e => e.stopPropagation()}>
            <input
              type="number"
              placeholder="Set target price (optional)"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              className="input text-xs py-2"
            />
            <button onClick={handleAdd} disabled={loading}
              className="btn-primary text-xs py-2 w-full disabled:opacity-50">
              {loading ? 'Adding…' : '+ Add to Wishlist'}
            </button>
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-1.5 badge-green rounded-xl px-3 py-2 text-sm font-semibold justify-center">
            <span>✓</span> <span>Added to Wishlist</span>
          </div>
        )}
      </div>
    </div>
  );
}
