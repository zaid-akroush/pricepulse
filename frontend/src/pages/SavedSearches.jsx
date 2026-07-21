import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import PageHeader from '../components/PageHeader';

export default function SavedSearches() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newQuery, setNewQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    api.get('/social/saved-searches')
      .then(r => setSearches(r.data))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    if (!newQuery.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/social/saved-searches', { query: newQuery.trim() });
      setSearches(prev => [res.data, ...prev.filter(s => s.id !== res.data.id)]);
      setNewQuery('');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    await api.delete(`/social/saved-searches/${id}`);
    setSearches(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader eyebrow="Shortcuts" title="Saved Searches" subtitle="Bookmark your favourite search queries for quick access." className="mb-6" />

      {/* Add new */}
      <form onSubmit={handleSave} className="card p-4 flex gap-2 mb-6">
        <input
          value={newQuery}
          onChange={e => setNewQuery(e.target.value)}
          placeholder="e.g. Sony WH-1000XM5"
          className="input flex-1"
        />
        <button type="submit" disabled={saving || !newQuery.trim()} className="btn-primary shrink-0 disabled:opacity-50 text-sm px-4">
          {saving ? '…' : 'Save'}
        </button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-4 animate-pulse h-14 surface-3" />)}
        </div>
      ) : searches.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-app-subtle flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-faint">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>No saved searches yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Save a search above or from the Search page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map(s => (
            <div key={s.id} className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{s.query}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Saved {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                  className="text-xs bg-brand text-on-brand px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  Search
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-faint hover:text-danger transition-colors px-1"
                  title="Delete saved search"
                  aria-label="Delete saved search"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
