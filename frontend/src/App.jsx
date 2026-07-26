import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import TutorialModal from './components/TutorialModal';
import Home from './pages/Home';
import Search from './pages/Search';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import SharedWishlist from './pages/SharedWishlist';
import Help from './pages/Help';
import Notifications from './pages/Notifications';
import Events from './pages/Events';
import Admin from './pages/Admin';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotFound from './pages/NotFound';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand focus:text-on-brand focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/wishlist" element={<PrivateRoute><Wishlist /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          {/* Analytics and Community are now tabs inside /wishlist, and Saved
              Searches is now the "Save search" button + Bookmarks popout on
              /search — these redirects keep any old bookmarks/links working. */}
          <Route path="/dashboard" element={<Navigate to="/wishlist?tab=analytics" replace />} />
          <Route path="/community" element={<Navigate to="/wishlist?tab=following" replace />} />
          <Route path="/accessories" element={<Navigate to="/search" replace />} />
          <Route path="/saved-searches" element={<Navigate to="/search" replace />} />
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/shared/:token" element={<SharedWishlist />} />
          <Route path="/events" element={<Events />} />
          <Route path="/help" element={<Help />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <InstallPrompt />
      <TutorialModal />
    </div>
  );
}
