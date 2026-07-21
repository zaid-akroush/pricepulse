import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import { FadeIn } from '../components/motion';

export default function Profile() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [pwMsg, setPwMsg] = useState(null);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await api.patch('/auth/profile', { name: form.name, email: form.email });
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile.' });
    } finally { setSaving(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return;
    }
    setPwSaving(true); setPwMsg(null);
    try {
      await api.patch('/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
    } finally { setPwSaving(false); }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <PageHeader eyebrow="Account" title="My Profile" className="mb-8" />

      {/* Avatar */}
      <FadeIn className="card p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-on-brand font-bold text-2xl shadow-[var(--shadow-brand)]">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-app">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
        </div>
      </FadeIn>

      {/* Profile form */}
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-app mb-4">Account Details</h2>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-muted mb-1.5">Full Name</label>
            <input id="profile-name" type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="input" required />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-muted mb-1.5">Email Address</label>
            <input id="profile-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="input" required />
          </div>
          {msg && (
            <p className={`text-sm p-3 rounded-xl ${msg.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="card p-6">
        <h2 className="font-bold text-app mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div>
            <label htmlFor="profile-current-password" className="block text-sm font-medium text-muted mb-1.5">Current Password</label>
            <input id="profile-current-password" type="password" value={pwForm.currentPassword}
              onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})}
              className="input" required />
          </div>
          <div>
            <label htmlFor="profile-new-password" className="block text-sm font-medium text-muted mb-1.5">New Password</label>
            <input id="profile-new-password" type="password" value={pwForm.newPassword}
              onChange={e => setPwForm({...pwForm, newPassword: e.target.value})}
              className="input" required />
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-muted mb-1.5">Confirm New Password</label>
            <input id="profile-confirm-password" type="password" value={pwForm.confirmPassword}
              onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})}
              className="input" required />
          </div>
          {pwMsg && (
            <p className={`text-sm p-3 rounded-xl ${pwMsg.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
              {pwMsg.text}
            </p>
          )}
          <button type="submit" disabled={pwSaving} className="btn-secondary disabled:opacity-50">
            {pwSaving ? 'Updating…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
