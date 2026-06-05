import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const [added, setAdded] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleAddToWishlist() {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/wishlist', {
        title: product.title,
        url: product.url,
        imageUrl: product.imageUrl,
        currentPrice: product.price,
        currency: product.currency,
        serpApiQuery: product.serpApiQuery,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      });
      setAdded(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add to wishlist');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-40 object-contain rounded-lg bg-gray-50"
        />
      )}

      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{product.title}</h3>
        {product.source && (
          <p className="text-xs text-gray-400 mt-0.5">{product.source}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-blue-600">
          {product.currency} {product.price?.toFixed(2) ?? 'N/A'}
        </span>
        {product.rating && (
          <span className="text-xs text-yellow-500">★ {product.rating}</span>
        )}
      </div>

      {!added ? (
        <div className="flex flex-col gap-2">
          <input
            type="number"
            placeholder="Target price (optional)"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleAddToWishlist}
            disabled={loading}
            className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding…' : '+ Add to Wishlist'}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="text-sm text-green-600 font-medium text-center py-1">✓ Added to Wishlist</div>
      )}

      {product.url && (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline text-center"
        >
          View on store →
        </a>
      )}
    </div>
  );
}
