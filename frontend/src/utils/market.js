// The shopping market a search runs in. Mirrors backend/src/services/markets.js
// (the backend is the authority; an unknown code falls back to 'us' there).
export const MARKETS = [
  { code: 'us', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'gb', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧' },
  { code: 'de', name: 'Germany', currency: 'EUR', flag: '🇩🇪' },
  { code: 'fr', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'it', name: 'Italy', currency: 'EUR', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', currency: 'EUR', flag: '🇪🇸' },
  { code: 'nl', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱' },
  { code: 'at', name: 'Austria', currency: 'EUR', flag: '🇦🇹' },
  { code: 'hu', name: 'Hungary', currency: 'HUF', flag: '🇭🇺' },
  { code: 'ch', name: 'Switzerland', currency: 'CHF', flag: '🇨🇭' },
  { code: 'ca', name: 'Canada', currency: 'CAD', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', currency: 'AUD', flag: '🇦🇺' },
  { code: 'in', name: 'India', currency: 'INR', flag: '🇮🇳' },
  { code: 'jp', name: 'Japan', currency: 'JPY', flag: '🇯🇵' },
  { code: 'jo', name: 'Jordan', currency: 'JOD', flag: '🇯🇴' },
];

const KEY = 'pp_market';

export function getMarket() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && MARKETS.some(m => m.code === saved)) return saved;
  } catch {}
  return 'us';
}

export function setMarket(code) {
  try { localStorage.setItem(KEY, code); } catch {}
}

export function marketInfo(code) {
  return MARKETS.find(m => m.code === code) || MARKETS[0];
}
