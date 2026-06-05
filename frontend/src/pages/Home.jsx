import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-5xl font-bold text-gray-900 mb-4">
        Never overpay again.
      </h1>
      <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
        PricePulse tracks electronics prices across Google Shopping and notifies
        you the moment your wishlist items drop to your target price.
      </p>

      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          to="/search"
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Search Products
        </Link>
        {!user && (
          <Link
            to="/register"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        )}
        {user && (
          <Link
            to="/wishlist"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            My Wishlist
          </Link>
        )}
      </div>

      <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
        {[
          { icon: '🔍', title: 'Search Any Product', desc: 'Search millions of electronics listings powered by Google Shopping in real time.' },
          { icon: '🔔', title: 'Set a Target Price', desc: 'Add items to your wishlist with a target price and we will watch it for you.' },
          { icon: '📧', title: 'Get Notified', desc: 'Receive an email the instant the price drops to or below your target.' },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-800 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
