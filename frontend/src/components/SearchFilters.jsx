import { useMemo } from 'react';

/**
 * Sidebar facets for the search results.
 *
 * Every facet is built FROM the current result set rather than from a fixed
 * list, so an option is only offered when it would actually match something —
 * a colour filter with nothing behind it is worse than no filter at all. Each
 * option carries its own count for the same reason.
 *
 * Listings that do not state an attribute are never hidden by a filter on a
 * DIFFERENT attribute, and "not stated" is its own visible option wherever it
 * applies, so a shopper can see what the data does not say instead of being
 * quietly shown fewer products than exist.
 */

const CONDITION_ORDER = ['new', 'open_box', 'used', 'refurbished'];
const CONDITION_LABELS = {
  new: 'New',
  open_box: 'Open box',
  used: 'Used',
  refurbished: 'Refurbished',
};

function countBy(items, pick) {
  const map = new Map();
  for (const item of items) {
    const key = pick(item);
    if (key === null || key === undefined || key === '') continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function FacetGroup({ title, options, selected, onToggle, note }) {
  if (options.length === 0) return null;
  return (
    <div className="border-t border-app pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <h4 className="text-xs uppercase tracking-widest font-semibold text-app mb-2">{title}</h4>
      {note && <p className="text-[11px] text-faint mb-2 leading-snug">{note}</p>}
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
        {options.map(opt => (
          <label key={String(opt.value)} className="flex items-center gap-2 text-sm cursor-pointer group">
            <input
              type="checkbox"
              className="accent-brand"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            <span className="text-muted group-hover:text-app transition-colors flex-1 min-w-0 truncate">{opt.label}</span>
            <span className="text-[11px] text-faint tabular-nums">{opt.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SearchFilters({ results, value, onChange, onClear }) {
  const carrierCount = useMemo(() => results.filter(r => r.carrierDeal).length, [results]);

  const facets = useMemo(() => {
    // Facet counts describe the listings the shopper can actually see, so a
    // hidden carrier listing must not inflate them.
    const visible = value.showCarrier ? results : results.filter(r => !r.carrierDeal);
    const conditions = countBy(visible, r => r.condition);
    // "Not stated" is a real answer here: most listings say nothing, and a
    // shopper filtering for New should be told that rather than shown an
    // empty list or, worse, unstated listings labelled New.
    const unstatedCondition = visible.filter(r => !r.condition).length;

    const conditionOptions = CONDITION_ORDER
      .filter(c => conditions.has(c))
      .map(c => ({ value: c, label: CONDITION_LABELS[c], count: conditions.get(c) }));
    if (unstatedCondition > 0) {
      conditionOptions.push({ value: '__unstated', label: 'Not stated', count: unstatedCondition });
    }

    const storage = [...countBy(visible, r => r.storageGb)]
      .sort((a, b) => a[0] - b[0])
      .map(([gb, count]) => ({
        value: gb,
        label: gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`,
        count,
      }));

    const colors = [...countBy(visible, r => r.color)]
      .sort((a, b) => b[1] - a[1])
      .map(([c, count]) => ({ value: c, label: c, count }));

    const brands = [...countBy(visible, r => r.brand)]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([b, count]) => ({ value: b, label: b, count }));

    const sellers = [...countBy(visible, r => r.source)]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([s, count]) => ({ value: s, label: s, count }));

    const screens = [...countBy(visible, r => r.screenInches)]
      .sort((a, b) => a[0] - b[0])
      .map(([n, count]) => ({ value: n, label: `${n}"`, count }));

    return { conditionOptions, storage, colors, brands, sellers, screens };
  }, [results, value.showCarrier]);

  function toggle(key, option) {
    const current = value[key] || [];
    const next = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    onChange({ ...value, [key]: next });
  }

  const activeCount = Object.entries(value)
    .filter(([key]) => key !== 'showCarrier')
    .reduce((n, [, arr]) => n + (arr?.length || 0), 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-app text-sm">Filters</h3>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs text-brand font-semibold hover:underline">
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* Carrier / leased offers. A toggle rather than a facet because the
          honest default is to hide them: a $29.99 "phone" from a carrier is
          the price of signing up for a plan, not the price of the phone, and
          showing it beside outright prices makes every real listing look bad.
          Hidden by default, and the count says what is being held back so
          the choice is visible rather than silent. */}
      {carrierCount > 0 && (
        <div className="pb-3 mb-3 border-b border-app">
          <label className="flex items-start gap-2 text-sm cursor-pointer group">
            <input
              type="checkbox"
              className="accent-brand mt-0.5"
              checked={Boolean(value.showCarrier)}
              onChange={() => onChange({ ...value, showCarrier: !value.showCarrier })}
            />
            <span className="flex-1 min-w-0">
              <span className="text-app font-medium">Show carrier &amp; leased deals</span>
              <span className="block text-[11px] text-faint leading-snug mt-0.5">
                {carrierCount} of these listings are plan, prepaid or lease prices, not the price of
                buying the device outright.
              </span>
            </span>
          </label>
        </div>
      )}

      <FacetGroup
        title="Condition"
        options={facets.conditionOptions}
        selected={value.condition || []}
        onToggle={v => toggle('condition', v)}
        note="Read from the listing title. Most sellers state nothing, which is not the same as new."
      />
      <FacetGroup title="Brand" options={facets.brands} selected={value.brand || []} onToggle={v => toggle('brand', v)} />
      <FacetGroup title="Storage" options={facets.storage} selected={value.storageGb || []} onToggle={v => toggle('storageGb', v)} />
      <FacetGroup title="Colour" options={facets.colors} selected={value.color || []} onToggle={v => toggle('color', v)} />
      <FacetGroup title="Screen size" options={facets.screens} selected={value.screenInches || []} onToggle={v => toggle('screenInches', v)} />
      <FacetGroup
        title="Seller"
        options={facets.sellers}
        selected={value.source || []}
        onToggle={v => toggle('source', v)}
        note="The retailer offering the listing. Shipping location is not published by the price source, so it cannot be filtered on."
      />
    </div>
  );
}

/** The filter shape, exported so the page and the reset button agree on it. */
export const EMPTY_FILTERS = {
  condition: [], brand: [], storageGb: [], color: [], screenInches: [], source: [],
  // Carrier/lease listings are hidden until asked for — see the toggle above.
  showCarrier: false,
};

/** Apply the sidebar selection to a result list. */
export function applyFilters(results, filters) {
  return results.filter(r => {
    if (r.carrierDeal && !filters.showCarrier) return false;
    for (const [key, selected] of Object.entries(filters)) {
      if (key === 'showCarrier') continue; // a toggle, not a facet list
      if (!selected || selected.length === 0) continue;
      if (key === 'condition') {
        const v = r.condition || '__unstated';
        if (!selected.includes(v)) return false;
        continue;
      }
      if (!selected.includes(r[key])) return false;
    }
    return true;
  });
}
