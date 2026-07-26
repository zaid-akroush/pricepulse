import { useCurrency } from '../context/CurrencyContext';

// Standardized price renderer: converts `amount` (stored in `currency`, e.g.
// "USD") into the user's chosen display currency and formats it. Using one
// component everywhere a price is shown means the whole app switches
// currency consistently instead of a handful of places being missed.
export default function Price({ amount, currency = 'USD', className = '' }) {
  const { format } = useCurrency();
  if (amount == null || Number.isNaN(amount)) return <span className={className}>—</span>;
  return <span className={className}>{format(amount, currency)}</span>;
}
