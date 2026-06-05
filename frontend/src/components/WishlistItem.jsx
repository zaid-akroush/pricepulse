import { useState } from 'react';
import api from '../api/axios';

export default function WishlistItem({ item, onRemove, onUpdate }) {
  const { product } = item;
  const [editing, setEditing] = useState(false);
  const [targetPrice, setTargetPrice] = useState(item.targetPrice ?? '');
  const [loading, setLoading] = useState(false);

  const priceChange = product.priceHistory?.length >= 2
    ? product.currentPrice - product.priceHistory[product.priceHistory.length - 2]?.price
    : null;

  async function handleUpdate() {
    setLoading(true);
    try {
      const updated = await api.patch(`/wishlist/${item.id}`, {
        targetPrice: targetPrice !== '' ? parseFloat(targetPrice) : null,
      });
      onUpdate(updated.data);
      setEditing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Remove this item from your wishlist?')) return;
    await api.delete(`/wishlist/${item.id}`);
    onRemove(item.id);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-4">
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-24 h-24 object-contain rounded-lg bg-gray-50 shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 text-sm leading-snug line-clamp-2">{product.title}</h3>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold text-blue-600">
            {product.currency} {product.currentPrice.toFixed(2)}
          </span>
          {priceChange !== null && (
            <span className={`text-xs font-medium ${priceChange < 0 ? 'text-green-500' : 'text-red-400'}`}>
              {priceChange < 0 ? '▼' : '▲'} {Math.abs(priceChange).toFixed(2)}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-0.5">
          Lowest: {product.currency} {product.lowestPrice.toFixed(2)} &nbsp;·&nbsp;
          Highest: {product.currency} {product.highestPrice.toFixed(2)}
        </p>

        {editing ? (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Target price"
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-36 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleUpdate}
              disabled={loading}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            Target: {item.targetPrice ? `${product.currency} ${item.targetPrice.toFixed(2)}` : 'Not set'}{' '}
            <button onClick={() => setEditing(true)} className="text-blue-500 hover:underline ml-1">Edit</button>
          </p>
        )}
      </div>

      <div className="flex flex-col items-end justify-between shrink-0">
        <button onClick={handleRemove} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}
