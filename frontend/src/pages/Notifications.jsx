import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProductImage from '../components/ProductImage';
import PushToggle from '../components/PushToggle';
import PageHeader from '../components/PageHeader';

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4' };
const TYPE_ICON = {
  price_drop:   { icon: <svg {...iconProps}><path d="M3 3v18h18" /><path d="M17 8l-6 6-3-3-4 4" /></svg>, color: 'text-success bg-success-soft' },
  target_hit:   { icon: <svg {...iconProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>, color: 'text-brand bg-brand-soft' },
  new_follower: { icon: <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" /></svg>, color: 'text-info bg-info-soft' },
  deal_alert:   { icon: <svg {...iconProps} fill="currentColor" stroke="none"><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" /></svg>, color: 'text-purple bg-purple-soft' },
};
const DEFAULT_ICON = <svg {...iconProps}><path d="M12 2a7 7 0 0 0-7 7v3.5L3 17h18l-2-4.5V9a7 7 0 0 0-7-7z" /><path d="M9 21a3 3 0 0 0 6 0" /></svg>;

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // A failed load is not "no notifications" — see Dashboard for the same bug.
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    let active = true;
    api.get('/social/notifications')
      .then(r => { if (active) { setNotifications(r.data); setLoadError(false); } })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  async function markAllRead() {
    // Applied only after the request succeeds. Flipping state first meant a
    // failed PATCH cleared the badge locally and the unread count reappeared
    // on the next page load, with nothing telling the user why.
    try {
      await api.patch('/social/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      setLoadError(false);
    }
  }

  async function markRead(id) {
    await api.patch(`/social/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : undefined}
        action={unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-brand hover:underline font-medium">
            Mark all read
          </button>
        )}
        className="mb-6"
      />

      <PushToggle />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 rounded w-3/4 surface-3 mb-2" />
              <div className="h-3 rounded w-1/2 surface-3" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="card p-16 text-center">
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>Couldn't load your notifications</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Something went wrong on our side. Please refresh to try again.</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text)' }}>All caught up!</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your notifications will appear here.</p>
          <Link to="/wishlist" className="btn-primary inline-block mt-6 text-sm">Go to Wishlist</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const meta = TYPE_ICON[n.type] || { icon: DEFAULT_ICON, color: 'text-muted surface-3' };
            return (
              <div
                key={n.id}
                className={`card p-4 flex gap-4 items-start cursor-pointer transition-all ${!n.read ? 'border-brand bg-brand-soft' : ''}`}
                onClick={() => { if (!n.read) markRead(n.id); if (n.product) navigate(`/product/${n.product.id}`); }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.message}</p>
                  {n.product && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{n.product.title}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
