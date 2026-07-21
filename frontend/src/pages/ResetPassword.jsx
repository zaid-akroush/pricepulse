import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Choose a new password"
      subtitle="Enter a new password for your account"
      footer={<Link to="/login" className="text-brand font-semibold hover:underline">Back to login</Link>}
    >
      {!token ? (
        <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl text-center">
          This reset link is missing its token. Please request a new one.
        </p>
      ) : done ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-app font-semibold mb-1">Password updated</p>
          <p className="text-sm text-muted">Redirecting you to the login page…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-muted mb-1.5">New password</label>
            <input id="reset-password" type="password" required value={form.password}
              onChange={e => setForm({...form, password: e.target.value})} className="input" placeholder="••••••••" />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="block text-sm font-medium text-muted mb-1.5">Confirm new password</label>
            <input id="reset-confirm" type="password" required value={form.confirm}
              onChange={e => setForm({...form, confirm: e.target.value})} className="input" placeholder="••••••••" />
          </div>

          {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary py-3 w-full disabled:opacity-50">
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
