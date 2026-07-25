import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { Stagger, StaggerItem } from '../components/motion';

const CATEGORIES = [
  { label: 'All',         q: '' },
  { label: 'Smartphones', q: 'smartphone' },
  { label: 'Laptops',     q: 'laptop' },
  { label: 'Headphones',  q: 'headphones' },
  { label: 'Gaming',      q: 'gaming console' },
  { label: 'Cameras',     q: 'digital camera' },
  { label: 'Tablets',     q: 'tablet' },
  { label: 'TVs',         q: '4K TV' },
  { label: 'Smart Home',  q: 'smart home' },
];

const SORTS = [
  { label: 'Relevance', value: 'default' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

export default function Search() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState('default');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  async function saveSearch() {
    if (!user) { navigate('/login'); return; }
    const q = searchParams.get('q');
    if (!q) return;
    try {
      await api.post('/social/saved-searches', { query: q });
      setSavedMsg('Saved!');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch { setSavedMsg('Already saved'); setTimeout(() => setSavedMsg(''), 2000); }
  }

  // Auto-search if ?q= param present
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      setSort('default');
      setMinPrice('');
      setMaxPrice('');
      setActiveCategory(q);
      doSearch(q);
    }
  }, [searchParams]);

  // Apply sort + filter whenever they change
  useEffect(() => {
    let out = [...results];
    if (minPrice !== '') out = out.filter(p => p.price >= parseFloat(minPrice));
    if (maxPrice !== '') out = out.filter(p => p.price <= parseFloat(maxPrice));
    if (sort === 'price_asc') out.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'price_desc') out.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    setFiltered(out);
  }, [results, sort, minPrice, maxPrice]);

  async function doSearch(q) {
    if (!q?.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    setResults([]); setFiltered([]);
    try {
      const { data } = await api.get(`/products/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed. Please try again.');
    } finally { setLoading(false); }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    // Navigating updates ?q=, which triggers the effect below to run the search
    // (avoids firing two identical API calls per submit).
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleCategory(cat) {
    setActiveCategory(cat.q);
    if (cat.q) { setQuery(cat.q); navigate(`/search?q=${encodeURIComponent(cat.q)}`); }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <p className="eyebrow mb-2">Discover</p>
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder='Search for any electronics… e.g. "Sony WH-1000XM5"'
            className="input text-sm py-3 pl-10" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50 px-6">
          {loading ? 'Searching…' : 'Search'}
        </button>
        {searched && searchParams.get('q') && (
          <button type="button" onClick={saveSearch}
            className="btn-ghost text-sm whitespace-nowrap"
            title="Save this search">
            {savedMsg || 'Save search'}
          </button>
        )}
      </form>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button key={cat.label} onClick={() => handleCategory(cat)}
            className={`chip shrink-0 ${activeCategory === cat.q ? 'chip-active' : ''}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      {searched && results.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center mb-6 card p-3">
          <span className="text-xs font-semibold text-muted uppercase tracking-wide">Filter & Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="input py-1.5 text-xs w-auto">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input type="number" placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)}
              className="input py-1.5 text-xs w-24" />
            <span className="text-faint text-xs">-</span>
            <input type="number" placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
              className="input py-1.5 text-xs w-24" />
          </div>
          {(minPrice || maxPrice || sort !== 'default') && (
            <button onClick={() => { setSort('default'); setMinPrice(''); setMaxPrice(''); }}
              className="text-xs text-danger hover:underline">Clear filters</button>
          )}
          <span className="ml-auto text-xs text-muted font-semibold">{filtered.length} results</span>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-danger text-sm mb-6 bg-danger-soft p-3 rounded-xl">{error}</p>}

      {/* Empty state */}
      {searched && !loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 text-muted">
          <div className="w-14 h-14 rounded-2xl bg-app-subtle flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-faint">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="font-semibold text-app">No results found for "{query}"</p>
          <p className="text-sm mt-1">Try a different search term or category.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(10).fill(0).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}

      {/* Results */}
      {!loading && filtered.length > 0 && (
        <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" stagger={0.04}>
          {filtered.map((product, i) => (
            // Always fold the array index into the key, even when product.url
            // exists — Google Shopping frequently returns multiple listings
            // that resolve to the same retailer URL, and a shared key made
            // React silently drop the render for every duplicate but the
            // first, leaving that grid cell blank.
            <StaggerItem key={`${product.url || product.title || 'item'}-${i}`}>
              <ProductCard product={product} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Hint if not searched yet */}
      {!searched && !loading && (
        <div className="text-center py-20 text-muted">
          <div className="w-16 h-16 rounded-2xl bg-app-subtle flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-faint">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-app">Search for any electronics product</p>
          <p className="text-sm mt-1">Powered by Google Shopping, results from all major retailers</p>
        </div>
      )}
    </div>
  );
}
