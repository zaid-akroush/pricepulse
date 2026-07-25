import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';
import { Stagger, StaggerItem } from '../components/motion';

function StatCard({ label, value }) {
  return (
    <div className="card p-5">
      <p className="text-3xl font-bold font-data text-app">{value ?? '-'}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState({ mostWishlisted: [], recentAlerts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [checkingPrices, setCheckingPrices] = useState(false);
  const [checkMessage, setCheckMessage] = useState(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    Promise.all([
      api.get('/admin/stats').then(r => setStats(r.data)),
      api.get('/admin/users').then(r => setUsers(r.data)),
      api.get('/admin/products').then(r => setProducts(r.data)),
    ])
      .catch(err => setError(err.response?.data?.error || 'Failed to load admin data.'))
      .finally(() => setLoading(false));
  }, [user]);

  // Non-admins never see this page.
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  async function handleDelete(u) {
    if (!window.confirm(`Delete ${u.name} (${u.email})? This removes their wishlist and all their data. This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      await api.delete(`/admin/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      setStats(s => s ? { ...s, users: s.users - 1 } : s);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete user.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleVisibility(u) {
    setTogglingId(u.id);
    try {
      const res = await api.patch(`/admin/users/${u.id}/wishlist-visibility`);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, wishlistPublic: res.data.wishlistPublic } : x));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update visibility.');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCheckPrices() {
    setCheckingPrices(true);
    setCheckMessage(null);
    try {
      const res = await api.post('/admin/check-prices');
      setCheckMessage(res.data.message);
    } catch (err) {
      setCheckMessage(err.response?.data?.error || 'Could not start price check.');
    } finally {
      setCheckingPrices(false);
    }
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <PageHeader
        eyebrow="Admin"
        title="Admin Dashboard"
        subtitle="Overview of PricePulse activity and users."
        className="mb-8"
        action={
          <div className="flex flex-col items-end gap-1.5">
            <button onClick={handleCheckPrices} disabled={checkingPrices} className="btn-secondary text-sm disabled:opacity-50">
              {checkingPrices ? 'Starting…' : 'Run price check now'}
            </button>
            {checkMessage && <p className="text-xs text-muted max-w-xs text-right">{checkMessage}</p>}
          </div>
        }
      />

      {error && <p className="text-sm text-danger bg-danger-soft p-3 rounded-xl mb-6">{error}</p>}
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {/* Stats */}
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10" stagger={0.05}>
            <StaggerItem><StatCard label="Users" value={stats?.users} /></StaggerItem>
            <StaggerItem><StatCard label="Products tracked" value={stats?.products} /></StaggerItem>
            <StaggerItem><StatCard label="Wishlist items" value={stats?.wishlistItems} /></StaggerItem>
            <StaggerItem><StatCard label="Alerts sent" value={stats?.alertsSent} /></StaggerItem>
          </Stagger>

          {/* Users */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-app mb-3">Users ({users.length})</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-black/5 dark:border-white/10">
                    <th className="p-3 font-semibold">Name</th>
                    <th className="p-3 font-semibold">Email</th>
                    <th className="p-3 font-semibold">Joined</th>
                    <th className="p-3 font-semibold text-center">Wishlist</th>
                    <th className="p-3 font-semibold text-center">Leaderboard</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                      <td className="p-3 text-app font-medium">{u.name}</td>
                      <td className="p-3 text-muted">{u.email}</td>
                      <td className="p-3 text-muted">{fmtDate(u.createdAt)}</td>
                      <td className="p-3 text-center text-app">{u.wishlistCount}</td>
                      <td className="p-3 text-center">
                        <span className={`badge ${u.wishlistPublic ? 'badge-green' : 'badge-neutral'}`}>
                          {u.wishlistPublic ? 'On leaderboard' : 'Hidden'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleToggleVisibility(u)}
                            disabled={togglingId === u.id}
                            className="text-xs font-semibold text-brand hover:opacity-80 disabled:opacity-50"
                          >
                            {togglingId === u.id ? 'Updating…' : u.wishlistPublic ? 'Hide from leaderboard' : 'Show on leaderboard'}
                          </button>
                          {u.id === user.id ? (
                            <span className="text-xs text-muted">You</span>
                          ) : (
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={deletingId === u.id}
                              className="text-xs font-semibold text-danger hover:opacity-80 disabled:opacity-50"
                            >
                              {deletingId === u.id ? 'Deleting…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Most wishlisted */}
          <section className="mb-10">
            <h2 className="text-xl font-bold text-app mb-3">Most wishlisted products</h2>
            {products.mostWishlisted.length === 0 ? (
              <p className="text-muted text-sm">No products tracked yet.</p>
            ) : (
              <div className="grid gap-3">
                {products.mostWishlisted.map(p => (
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-contain rounded-lg surface-2" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-app font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted font-data">{p.currency} {p.currentPrice?.toFixed(2)}</p>
                    </div>
                    <span className="text-sm font-bold font-data text-brand shrink-0">{p.wishlistCount} ♥</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent alerts */}
          <section>
            <h2 className="text-xl font-bold text-app mb-3">Recent price alerts</h2>
            {products.recentAlerts.length === 0 ? (
              <p className="text-muted text-sm">No alerts sent yet.</p>
            ) : (
              <div className="card divide-y divide-black/5 dark:divide-white/5">
                {products.recentAlerts.map(a => (
                  <div key={a.id} className="p-3">
                    <p className="text-sm text-app">{a.message}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {a.user?.email} · {fmtDate(a.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
