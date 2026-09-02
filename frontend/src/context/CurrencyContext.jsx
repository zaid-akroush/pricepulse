import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const CurrencyContext = createContext();

// Kept in sync with backend/src/services/currency.js's SUPPORTED list.
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JOD', label: 'Jordanian Dinar', symbol: 'JD' },
  { code: 'HUF', label: 'Hungarian Forint', symbol: 'Ft' },
];

function readInitialCurrency() {
  try {
    const saved = localStorage.getItem('displayCurrency');
    if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) return saved;
  } catch {}
  return 'USD';
}

export function CurrencyProvider({ children }) {
  const [displayCurrency, setDisplayCurrencyState] = useState(readInitialCurrency);
  // rates are always fetched with base=USD, since nearly every stored
  // Product.currency is "USD" — converting FROM any currency TO the display
  // currency is then just two divisions through this one common base.
  const [rates, setRates] = useState(null);

  useEffect(() => {
    api.get('/currency/rates', { params: { base: 'USD' } })
      .then(r => setRates(r.data.rates))
      .catch(() => setRates(null)); // fall through to 1:1 (no conversion) if the rates service is down
  }, []);

  function setDisplayCurrency(code) {
    setDisplayCurrencyState(code);
    try { localStorage.setItem('displayCurrency', code); } catch {}
  }

  // Converts `amount` (in `fromCurrency`) into the user's chosen display
  // currency. Falls back to returning the amount unconverted (with its
  // original currency) if rates haven't loaded yet or either currency isn't
  // one we have a rate for, rather than showing a broken/NaN price.
  const convert = useCallback((amount, fromCurrency = 'USD') => {
    if (amount == null || Number.isNaN(amount)) return { amount, currency: fromCurrency };
    if (!rates || fromCurrency === displayCurrency) return { amount, currency: fromCurrency };
    const fromRate = rates[fromCurrency];
    const toRate = rates[displayCurrency];
    if (!fromRate || !toRate) return { amount, currency: fromCurrency };
    // rates are all relative to the USD base: amount_in_usd = amount / fromRate
    const amountInUsd = amount / fromRate;
    return { amount: amountInUsd * toRate, currency: displayCurrency };
  }, [rates, displayCurrency]);

  const format = useCallback((amount, fromCurrency = 'USD') => {
    const { amount: converted, currency } = convert(amount, fromCurrency);
    if (converted == null || Number.isNaN(converted)) return 'N/A';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(converted);
    } catch {
      return `${currency} ${converted.toFixed(2)}`;
    }
  }, [convert]);

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency, rates, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
