import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await login(form.email, form.password);
      navigate('/wishlist');
    } catch (err) {
      // The backend intentionally returns one generic message for both a
      // wrong password and a non-existent email, so a login attempt can't
      // be used to enumerate which addresses are registered.
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in"
      subtitle="Log in to your PricePulse account"
      footer={<>Don't have an account? <Link to="/register" className="text-brand font-semibold hover:underline">Sign up free</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-muted mb-1.5">Email</label>
          <input id="login-email" type="email" required value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} className="input" placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-muted">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand font-semibold hover:underline">Forgot password?</Link>
          </div>
          <input id="login-password" type="password" required value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} className="input" placeholder="••••••••" />
        </div>

        {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary py-3 w-full disabled:opacity-50">
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </AuthLayout>
  );
}
