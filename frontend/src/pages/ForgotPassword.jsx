import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
      footer={<>Remembered it? <Link to="/login" className="text-brand font-semibold hover:underline">Back to login</Link></>}
    >
      {sent ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-app mb-2 font-semibold">Check your inbox</p>
          <p className="text-sm text-muted">A password reset link has been sent to <span className="font-medium">{email}</span>. The link expires in 1 hour.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-muted mb-1.5">Email</label>
            <input id="forgot-email" type="email" required value={email}
              onChange={e => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
          </div>

          {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary py-3 w-full disabled:opacity-50">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
