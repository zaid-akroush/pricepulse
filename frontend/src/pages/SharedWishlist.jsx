import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import ProductImage from '../components/ProductImage';
import PageHeader from '../components/PageHeader';

// Public, read-only view of a single user's wishlist via a share token.
// No auth required, and the backend only returns the owner's display name
// and their wishlist items — no email or other account data.
export default function SharedWishlist() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/social/shared-wishlist/${token}`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.status === 404 ? 'This wishlist link is invalid or has been revoked.' : 'Failed to load wishlist.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse surface-3" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-danger font-medium mb-4">{error}</p>
      <Link to="/" className="btn-primary">Go Home</Link>
    </div>
  );

  const items = data.items || [];
  const totalValue = items.reduce((sum, i) => sum + i.product.currentPrice, 0);

  return (
    <div className="bg-app min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <PageHeader
          eyebrow="Shared Wishlist"
          title={`${data.name}'s Wishlist`}
          subtitle={items.length === 0 ? 'No products tracked yet' : `${items.length} product${items.length !== 1 ? 's' : ''} · $${totalValue.toFixed(2)} total`}
          className="mb-8"
        />

        {items.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-lg font-bold text-app mb-2">This wishlist is empty</p>
            <p className="text-sm text-muted">Nothing has been added yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map(item => {
              const { product } = item;
              const dropPercent = product.highestPrice > 0
                ? Math.round(((product.highestPrice - product.currentPrice) / product.highestPrice) * 100)
                : 0;
              return (
                <Link key={item.id} to={`/product/${product.id}`} className="card card-hover p-4 flex gap-4">
                  <div className="w-20 h-20 rounded-xl surface-2 shrink-0 overflow-hidden flex items-center justify-center p-1.5">
                    <ProductImage src={product.imageUrl} alt={product.title} productId={product.id} className="w-full h-full object-contain" fallbackClass="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app line-clamp-2 leading-snug">{product.title}</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-lg price-tag">{product.currency} {product.currentPrice.toFixed(2)}</span>
                      {dropPercent > 0 && <span className="badge badge-green">{dropPercent}% below peak</span>}
                    </div>
                    {item.targetPrice != null && (
                      <p className="text-xs text-muted mt-1">Target: {product.currency} {item.targetPrice.toFixed(2)}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-xs text-faint text-center mt-8">
          This is a read-only shared view. <Link to="/register" className="text-brand hover:underline">Create your own PricePulse account</Link> to track prices.
        </p>
      </div>
    </div>
  );
}
