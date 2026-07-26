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
  // Defaults true (matches the backend default) until /auth/me confirms it,
  // so this doesn't flash the wrong state on load.
  const [wishlistPublic, setWishlistPublic] = useState(user?.wishlistPublic ?? true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(user?.emailAlertsEnabled ?? true);
  const [emailSaving, setEmailSaving] = useState(false);

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

  async function togglePrivacy() {
    const next = !wishlistPublic;
    setWishlistPublic(next); // optimistic
    setPrivacySaving(true);
    try {
      await api.patch('/auth/profile', { name: form.name, email: form.email, wishlistPublic: next });
    } catch {
      setWishlistPublic(!next); // revert on failure
    } finally { setPrivacySaving(false); }
  }

  async function toggleEmailAlerts() {
    const next = !emailAlertsEnabled;
    setEmailAlertsEnabled(next); // optimistic
    setEmailSaving(true);
    try {
      await api.patch('/auth/profile', { name: form.name, email: form.email, emailAlertsEnabled: next });
    } catch {
      setEmailAlertsEnabled(!next); // revert on failure
    } finally { setEmailSaving(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return;
    }
    if (pwForm.newPassword.length < 10) {
      setPwMsg({ type: 'error', text: 'Password must be at least 10 characters.' }); return;
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

      {/* Privacy */}
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-app mb-1">Privacy</h2>
        <p className="text-sm text-muted mb-4">Control whether others can find and follow your wishlist.</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-app">Show my wishlist to others</p>
            <p className="text-xs text-muted mt-0.5">
              When off, your profile won't show up in Wishlist &rarr; Following search, and no one can follow you.
            </p>
          </div>
          <button
            onClick={togglePrivacy}
            disabled={privacySaving}
            role="switch"
            aria-checked={wishlistPublic}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${wishlistPublic ? 'bg-brand' : 'surface-3'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform ${wishlistPublic ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-6 mb-6">
        <h2 className="font-bold text-app mb-1">Notifications</h2>
        <p className="text-sm text-muted mb-4">Control how you hear about price drops.</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-app">Email price-drop alerts</p>
            <p className="text-xs text-muted mt-0.5">
              When off, you'll still see alerts in Notifications inside the app, just no email will be sent.
            </p>
          </div>
          <button
            onClick={toggleEmailAlerts}
            disabled={emailSaving}
            role="switch"
            aria-checked={emailAlertsEnabled}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors disabled:opacity-50 ${emailAlertsEnabled ? 'bg-brand' : 'surface-3'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform ${emailAlertsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
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
