import { useEffect, useState } from 'react';
import api from '../api/axios';
import WishlistItem from '../components/WishlistItem';
import { Link } from 'react-router-dom';

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/wishlist')
      .then(res => setItems(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load wishlist'))
      .finally(() => setLoading(false));
  }, []);

  function handleRemove(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handleUpdate(updated) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading wishlist…</div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">My Wishlist</h1>
      <p className="text-sm text-gray-500 mb-8">
        {items.length} item{items.length !== 1 ? 's' : ''} tracked
      </p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-4">🛒</p>
          <p className="mb-4">Your wishlist is empty.</p>
          <Link to="/search" className="text-blue-600 hover:underline">
            Search for products →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map(item => (
            <WishlistItem key={item.id} item={item} onRemove={handleRemove} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
