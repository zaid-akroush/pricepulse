// Is this price the whole price, or a payment towards it?
//
// A shopping listing states a number, not what the number means. Retailers
// advertise instalments, leases and subscriptions in exactly the same field
// as an outright price, so "Apple Watch Series 9 - $39.00" can mean $39 for
// the watch or $39 a month for 12 months towards a $469 watch.
//
// For a price TRACKER that distinction is the whole product. A monthly figure
// recorded as the price makes a $499 watch look 92% below peak, marks it a
// "Blazing Deal", and writes a lowestPrice into the history that no one can
// ever pay for the device outright.
//
// So the payment type is decided here, once, from every piece of text the
// providers give us, and everything downstream (filtering, price history,
// the badges on the page) reads the answer rather than re-guessing it.

// "$39.00/mo", "$39 per month", "39.99 monthly", "€12,99/Monat"
const PER_PERIOD_RE = /(\/|\bper\s+)\s*(mo\b|month|monat|mois|mes|wk\b|week|yr\b|year)|\bmonthly\b|\bper month\b|\/mo\b/i;

// "for 12 mo.", "over 24 months", "12 monthly payments", "36 mo financing"
const TERM_RE = /\b(?:for|over|across)?\s*(\d{1,3})\s*(?:mo\b|mos\b|month|months)\b/i;

// Wording that means the figure is an instalment even without a period suffix.
const INSTALMENT_WORDS_RE = /\b(installment|instalment|instal?ments?|financ(?:e|ing)|monthly payments?|pay monthly|pay over time|split into|affirm|klarna|afterpay|zip pay|0% apr|apr\b|down payment|deposit|trade[\s-]?in credit|bill credits?)\b/i;

// Leases and upgrade programmes: you never own the device at this price.
const LEASE_WORDS_RE = /\b(lease|leasing|leased|rent[\s-]?to[\s-]?own|rental|upgrade programme|upgrade program|apple upgrade|device payment plan)\b/i;

// Ongoing services rather than a product.
const SUBSCRIPTION_WORDS_RE = /\b(subscription|per user|\/user|membership|plan includes|billed (?:monthly|annually|yearly))\b/i;

const TYPES = {
  ONE_TIME: 'one_time',
  INSTALLMENT: 'installment',
  LEASE: 'lease',
  SUBSCRIPTION: 'subscription',
};

const LABELS = {
  one_time: 'One-time price',
  installment: 'Monthly instalment',
  lease: 'Lease payment',
  subscription: 'Subscription',
};

/**
 * Work out what a listing's price actually represents.
 *
 * Every text field is considered, not just the price string: providers put
 * "for 12 mo." in an extension, the word "lease" in the title, and the bare
 * number in `price`, so reading any one of them alone misses most cases.
 *
 * @param {object} input
 * @param {string|number|null} [input.price] the price field as given
 * @param {string|null} [input.title]
 * @param {string[]|string|null} [input.extras] extensions, delivery, snippet
 * @returns {{type: string, label: string, recurring: boolean, months: number|null, evidence: string|null}}
 */
function detectPaymentTerms({ price = null, title = null, extras = null } = {}) {
  const priceText = typeof price === 'string' ? price : '';
  const extraText = Array.isArray(extras) ? extras.join(' ') : (extras || '');
  const haystacks = [
    ['price', priceText],
    ['extras', String(extraText)],
    ['title', String(title || '')],
  ];

  let months = null;
  for (const [, text] of haystacks) {
    const m = text.match(TERM_RE);
    if (m) {
      const n = parseInt(m[1], 10);
      // 2 to 60 months is a financing term; "for 1 mo" or "for 500 months" is
      // something else being matched by accident.
      if (n >= 2 && n <= 60) { months = n; break; }
    }
  }

  for (const [field, text] of haystacks) {
    if (!text) continue;
    if (LEASE_WORDS_RE.test(text)) {
      return { type: TYPES.LEASE, label: LABELS.lease, recurring: true, months, evidence: field };
    }
  }

  for (const [field, text] of haystacks) {
    if (!text) continue;
    if (SUBSCRIPTION_WORDS_RE.test(text)) {
      return { type: TYPES.SUBSCRIPTION, label: LABELS.subscription, recurring: true, months, evidence: field };
    }
  }

  for (const [field, text] of haystacks) {
    if (!text) continue;
    if (PER_PERIOD_RE.test(text) || INSTALMENT_WORDS_RE.test(text)) {
      return { type: TYPES.INSTALLMENT, label: LABELS.installment, recurring: true, months, evidence: field };
    }
  }

  // A term on its own ("for 12 mo.") alongside a price is financing too: a
  // one-time price has no number of months attached to it.
  if (months) {
    return { type: TYPES.INSTALLMENT, label: LABELS.installment, recurring: true, months, evidence: 'term' };
  }

  return { type: TYPES.ONE_TIME, label: LABELS.one_time, recurring: false, months: null, evidence: null };
}

/**
 * What the device would cost in total at this instalment, when the listing
 * states a term. Never treated as the product's price: it is what the shopper
 * would actually pay, shown so the monthly figure can be put in proportion.
 *
 * @returns {number|null}
 */
function totalOverTerm(price, months) {
  if (!(price > 0) || !months) return null;
  const total = price * months;
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}

/**
 * Does this observation look like a payment rather than a price, judged
 * against what the product has historically cost?
 *
 * The text checks above catch a labelled instalment. This catches the
 * unlabelled one: a $499 watch that suddenly reads $39 is not a 92% discount,
 * it is a monthly figure that lost its "/mo" somewhere between the retailer
 * and us. Tracking it would write a low into the history that nobody can buy
 * the device for.
 *
 * @param {number} price the new observation
 * @param {number[]} history previously recorded prices for this product
 * @returns {{implausible: boolean, ratio: number|null, reference: number|null}}
 */
const IMPLAUSIBLE_RATIO = 0.35;   // 65% below its own typical price
const MIN_HISTORY = 3;            // below this there is nothing to compare to

function looksLikeUnlabelledPayment(price, history = []) {
  const past = history.filter(p => p > 0 && Number.isFinite(p));
  if (!(price > 0) || past.length < MIN_HISTORY) {
    return { implausible: false, ratio: null, reference: null };
  }

  // Median, not mean: one bad row should not drag the reference with it.
  const sorted = [...past].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (!(median > 0)) return { implausible: false, ratio: null, reference: null };

  const ratio = price / median;
  return { implausible: ratio < IMPLAUSIBLE_RATIO, ratio, reference: median };
}

module.exports = {
  detectPaymentTerms,
  totalOverTerm,
  looksLikeUnlabelledPayment,
  PAYMENT_TYPES: TYPES,
  PAYMENT_LABELS: LABELS,
  IMPLAUSIBLE_RATIO,
};
