import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { describeApiError } from '../api/errorMessage';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: searchParams.get('email') || '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 10) { setError('Password must be at least 10 characters.'); return; }
    setLoading(true); setError(null);
    try {
      await register(form.name, form.email, form.password);
      navigate('/wishlist');
    } catch (err) {
      setError(describeApiError(err, 'Registration failed. Please try again.'));
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Start tracking prices for free"
      footer={<>Already have an account? <Link to="/login" className="text-brand font-semibold hover:underline">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium text-muted mb-1.5">Full Name</label>
          <input id="register-name" type="text" required value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-muted mb-1.5">Email</label>
          <input id="register-email" type="email" required value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-muted mb-1.5">Password</label>
          <input id="register-password" type="password" required value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} className="input" placeholder="At least 10 characters" />
        </div>

        {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary py-3 w-full disabled:opacity-50">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>
    </AuthLayout>
  );
}
