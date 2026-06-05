import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-blue-600">
          PricePulse
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/search" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
            Search
          </Link>
          {user ? (
            <>
              <Link to="/wishlist" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                Wishlist
              </Link>
              <span className="text-sm text-gray-500">Hi, {user.name.split(' ')[0]}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
