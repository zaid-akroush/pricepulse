import { useState, useEffect, useRef } from 'react';
import AdminDiagnostic from '../components/AdminDiagnostic';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProductCard from '../components/ProductCard';
import { ProductCardSkeleton } from '../components/Skeleton';
import { Stagger, StaggerItem } from '../components/motion';
import { describeApiError } from '../api/errorMessage';
import SearchFilters, { EMPTY_FILTERS, applyFilters } from '../components/SearchFilters';

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

// Merged in from the old standalone Accessories page — accessories are just
// another product category, so they belong in the same search flow instead
// of a separate page with its own search box.
const ACCESSORY_CATEGORIES = [
  { label: 'Cases',              q: 'phone case' },
  { label: 'Chargers',           q: 'USB-C charger fast charging' },
  { label: 'Cables',             q: 'USB-C cable braided' },
  { label: 'Earbuds',            q: 'wireless earbuds' },
  { label: 'Power Banks',        q: 'power bank portable charger' },
  { label: 'Screen Protectors',  q: 'screen protector tempered glass' },
  { label: 'MagSafe',            q: 'MagSafe accessories' },
  { label: 'Keyboards',          q: 'bluetooth keyboard compact' },
];

// Desktop/PC build components — a separate chip row since these are a
// distinct shopping intent (building/upgrading a PC) from finished devices
// and phone accessories above.
const PC_PART_CATEGORIES = [
  { label: 'Graphics Cards', q: 'graphics card GPU' },
  { label: 'Processors',     q: 'CPU processor' },
  { label: 'Motherboards',   q: 'motherboard' },
  { label: 'RAM',            q: 'RAM memory desktop' },
  { label: 'SSDs',           q: 'SSD solid state drive' },
  { label: 'Power Supplies', q: 'PSU power supply' },
  { label: 'PC Cases',       q: 'PC case tower' },
  { label: 'CPU Coolers',    q: 'CPU cooler' },
];

const SORTS = [
  { label: 'Relevance', value: 'default' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
];

// The admin diagnostic rides along as base64 JSON in a response header
// (the success body is a plain array and has nowhere to put it).
function decodeDiagnostic(header) {
  if (!header) return null;
  try { return JSON.parse(atob(header)); } catch { return null; }
}

export default function Search() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Present only for admins — the backend attaches it to failure responses.
  const [diagnostic, setDiagnostic] = useState(null);
  // Why the results are cached rather than live, when the backend says so.
  const [degraded, setDegraded] = useState(null);
  // Set when the query was a country name and we searched its tech brands.
  const [country, setCountry] = useState(null);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState('default');
  const [minPrice, setMinPrice] = useState('');
  // Sidebar facets (condition, brand, storage, colour, screen, seller).
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile drawer
  const [maxPrice, setMaxPrice] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  // Bumped once per successful save to refresh the bookmarks list.
  const [bookmarksVersion, setBookmarksVersion] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);

  // Bookmarks sidebar: reuses the existing saved-searches feature so past
  // searches are one click away instead of retyping them.
  useEffect(() => {
    if (!user) { setBookmarks([]); return; }
    api.get('/social/saved-searches').then(r => setBookmarks(r.data)).catch(() => {});
    // `savedMsg` used to be a dependency, and it is set twice per save
    // ('Saved!' then '' two seconds later), so every save fired three
    // fetches. `bookmarksVersion` is bumped exactly once per save instead.
  }, [user, bookmarksVersion]);

  async function removeBookmark(id) {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    try { await api.delete(`/social/saved-searches/${id}`); } catch {}
  }

  async function saveSearch() {
    if (!user) { navigate('/login'); return; }
    const q = searchParams.get('q');
    if (!q) return;
    try {
      await api.post('/social/saved-searches', { query: q });
      setBookmarksVersion(v => v + 1);
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
    out = applyFilters(out, filters);
    if (minPrice !== '') out = out.filter(p => p.price >= parseFloat(minPrice));
    if (maxPrice !== '') out = out.filter(p => p.price <= parseFloat(maxPrice));
    if (sort === 'price_asc') out.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === 'price_desc') out.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    setFiltered(out);
  }, [results, sort, minPrice, maxPrice, filters]);

  // Which search is the current one. Clicking "Laptops" then "Cameras" fires
  // two overlapping requests, and whichever resolved last used to win — so
  // the page could show laptops while the URL and the active chip both said
  // Cameras. Every response now checks it is still the newest before it is
  // allowed to touch state.
  const searchSeq = useRef(0);

  async function doSearch(q) {
    if (!q?.trim()) return;
    const seq = ++searchSeq.current;
    setLoading(true); setError(null); setDiagnostic(null); setDegraded(null); setCountry(null); setSearched(true);
    setFilters(EMPTY_FILTERS); // facets describe the previous result set
    setResults([]); setFiltered([]);
    try {
      const res = await api.get(`/products/search?q=${encodeURIComponent(q)}`);
      if (seq !== searchSeq.current) return; // superseded by a newer search
      setResults(res.data);
      // A 200 can still be a degraded answer: the backend serves cached rows
      // when the live provider fails, and says why in these headers.
      setDegraded(res.headers['x-search-degraded'] ? (res.headers['x-search-reason'] || null) : null);
      // A country name was recognised and answered with that country's brands.
      setCountry(res.headers['x-search-country']
        ? { country: res.headers['x-search-country'], brands: res.headers['x-search-brands'] || '' }
        : null);
      setDiagnostic(decodeDiagnostic(res.headers['x-search-diagnostic']));
    } catch (err) {
      if (seq !== searchSeq.current) return;
      // A body with no `error` field means no response came back at all —
      // API down, wrong VITE_API_URL, or a CORS block — not a failed search.
      setError(describeApiError(err, 'Search failed. Please try again.'));
      setDiagnostic(err.response?.data?.diagnostic || null);
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
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
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button key={cat.label} onClick={() => handleCategory(cat)}
            className={`chip shrink-0 ${activeCategory === cat.q ? 'chip-active' : ''}`}>
            {cat.label}
          </button>
        ))}
      </div>
      {/* Accessory chips (merged in from the old standalone Accessories page) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        <span className="text-[11px] font-bold text-faint uppercase tracking-widest shrink-0">Accessories</span>
        {ACCESSORY_CATEGORIES.map(cat => (
          <button key={cat.label} onClick={() => handleCategory(cat)}
            className={`chip shrink-0 !py-1.5 !px-3 text-xs ${activeCategory === cat.q ? 'chip-active' : ''}`}>
            {cat.label}
          </button>
        ))}
      </div>
      {/* PC parts chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        <span className="text-[11px] font-bold text-faint uppercase tracking-widest shrink-0">PC Parts</span>
        {PC_PART_CATEGORIES.map(cat => (
          <button key={cat.label} onClick={() => handleCategory(cat)}
            className={`chip shrink-0 !py-1.5 !px-3 text-xs ${activeCategory === cat.q ? 'chip-active' : ''}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Filters row — bookmarks now live here as a popout instead of a full
          side column, so the results grid gets the full page width and one
          more column of products fits per row. */}
      {searched && results.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center mb-6 card p-2.5">
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
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="lg:hidden text-xs font-semibold text-brand hover:underline"
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
          {(minPrice || maxPrice || sort !== 'default') && (
            <button onClick={() => { setSort('default'); setMinPrice(''); setMaxPrice(''); }}
              className="text-xs text-danger hover:underline">Clear filters</button>
          )}
          <span className="text-xs text-muted font-semibold">{filtered.length} results</span>
          {user && (
            <div className="ml-auto">
              <BookmarksMenu bookmarks={bookmarks} onSelect={q => navigate(`/search?q=${encodeURIComponent(q)}`)} onRemove={removeBookmark} />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6">
          <p className="text-danger text-sm bg-danger-soft p-3 rounded-xl">{error}</p>
          <AdminDiagnostic diagnostic={diagnostic} />
        </div>
      )}

      {!loading && country && (
        <p className="text-xs text-muted mb-4 bg-app-subtle p-3 rounded-xl">
          <strong className="text-app">{country.country}</strong> is a country, so this shows tech products from
          brands headquartered there{country.brands ? ` — ${country.brands}` : ''}. Manufacturing location is not
          shown: almost all consumer electronics are assembled in the same few countries, and no price source
          reports it. Search a product name instead for a normal search.
        </p>
      )}

      {!loading && filtered.length > 0 && filtered.some(p => p.stale) && (
        <div className="mb-4">
          <p className="text-xs text-muted bg-app-subtle p-3 rounded-xl">
            {/* The backend's own reason, when it sent one — "temporarily
                unavailable" was wrong for a failure that persists until
                someone acts, such as an exhausted provider plan. */}
            {degraded
              ? `${degraded} Showing last-known prices from products already tracked on PricePulse.`
              : 'Live search is unavailable right now, showing last-known prices from products already tracked on PricePulse.'}
          </p>
          <AdminDiagnostic diagnostic={diagnostic} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Facets. Hidden on small screens until asked for, so the results
            stay the first thing on the page on a phone. */}
        {!loading && results.length > 0 && (
          <aside className={`${filtersOpen ? 'block' : 'hidden'} lg:block w-full lg:w-60 shrink-0`}>
            <div className="lg:sticky lg:top-24">
              <SearchFilters
                results={results}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters(EMPTY_FILTERS)}
              />
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          {/* Empty state */}
          {searched && !loading && filtered.length === 0 && !error && (
            <div className="text-center py-16 text-muted">
              <div className="w-14 h-14 rounded-2xl bg-app-subtle flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-faint">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <p className="font-semibold text-app">
                {results.length > 0 ? 'No results match your filters' : `No results found for "${query}"`}
              </p>
              <p className="text-sm mt-1">
                {results.length > 0
                  ? `${results.length} products were found for "${query}" — clear a filter to see them.`
                  : 'Try a different search term or category.'}
              </p>
              {results.length > 0 && (
                <button onClick={() => { setFilters(EMPTY_FILTERS); setMinPrice(''); setMaxPrice(''); }}
                  className="btn-secondary mt-4 text-sm">Clear all filters</button>
              )}
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
      </div>
    </div>
  );
}

/* Compact popout version of the bookmarks list — lives inline in the
   Filter & Sort bar instead of taking up a whole side column, so the
   results grid gets the full page width. */
function BookmarksMenu({ bookmarks, onSelect, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs font-semibold text-muted hover:text-brand flex items-center gap-1.5 px-2 py-1"
        aria-expanded={open}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4-7 4V5z" />
        </svg>
        Bookmarks{bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-64 card p-2 shadow-float">
            {bookmarks.length === 0 ? (
              <p className="text-xs text-muted p-2.5">
                Save a search with the "Save search" button above to bookmark it here.
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {bookmarks.map(b => (
                  <div key={b.id} className="group flex items-center gap-1.5">
                    <button
                      onClick={() => { onSelect(b.query); setOpen(false); }}
                      className="flex-1 min-w-0 text-left text-sm text-muted hover:text-brand hover:bg-brand-soft font-medium py-1.5 px-2.5 rounded-xl transition-colors truncate"
                      title={b.query}
                    >
                      {b.query}
                    </button>
                    <button
                      onClick={() => onRemove(b.id)}
                      className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger text-xs px-1.5 shrink-0 transition-opacity"
                      title="Remove bookmark"
                      aria-label="Remove bookmark"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
