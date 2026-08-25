// Parsing a price string out of a shopping listing.
//
// The naive version of this was `parseFloat(str.replace(/[^0-9.]/g, ''))`,
// which does not fail on input it cannot understand — it concatenates
// whatever digits it finds and returns a confident, wrong number:
//
//   "€1.299,00"                  -> 1.299       (dropped as implausible)
//   "US$ 1 099,99"               -> 109999      (100x too high)
//   "$12.99 - $15.99"            -> 12.9915
//   "Now $1,199.00 was $1,399.00"-> 1199.001399
//
// A 100x overstatement is the dangerous one: `highestPrice` only ever ratchets
// upward, so one bad reading permanently poisons every "% below peak" figure
// and deal score for that product.
//
// This parser instead extracts well-formed number tokens, works out whether
// `,` or `.` is the decimal separator from its position, and REFUSES anything
// ambiguous by returning null. A dropped listing is recoverable; a wrong price
// written into price history is not.

// A number token: digits, optionally grouped, optionally with a decimal part.
const NUMBER_TOKEN_RE = /\d[\d.,  ]*\d|\d/g;

/**
 * Parse one numeric token that has already been isolated from surrounding text.
 * @returns {number|null}
 */
function parseNumberToken(token) {
  // Strip spaces used as thousands separators ("1 099,99", NBSP variants).
  const t = token.replace(/[\s ]/g, '');
  if (!t) return null;

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');

  let normalized;
  if (lastComma === -1 && lastDot === -1) {
    normalized = t;
  } else {
    // Whichever separator appears last is the decimal one — unless the group
    // after it isn't 1-2 digits, in which case it's a thousands separator
    // ("1.099" is one thousand and ninety-nine, not 1.099).
    const decimalPos = Math.max(lastComma, lastDot);
    const decimals = t.length - decimalPos - 1;
    const isDecimalSeparator = decimals >= 1 && decimals <= 2;

    if (isDecimalSeparator) {
      const intPart = t.slice(0, decimalPos).replace(/[.,]/g, '');
      const fracPart = t.slice(decimalPos + 1);
      normalized = `${intPart}.${fracPart}`;
    } else {
      normalized = t.replace(/[.,]/g, '');
    }
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a price out of a listing's price field.
 *
 * Returns null rather than guessing when the string contains more than one
 * distinct price (a range, or a was/now pair), because picking the wrong one
 * silently corrupts the product's price history.
 *
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
function parsePrice(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const str = raw.trim();
  if (!str) return null;

  const tokens = str.match(NUMBER_TOKEN_RE);
  if (!tokens || tokens.length === 0) return null;

  const values = tokens.map(parseNumberToken).filter(v => v !== null && v > 0);
  if (values.length === 0) return null;

  // More than one distinct price in the string: a range ("$12.99 - $15.99") or
  // a was/now pair. Ambiguous, so refuse it.
  const distinct = [...new Set(values)];
  if (distinct.length > 1) return null;

  return distinct[0];
}

/**
 * True when a price string describes a recurring charge rather than the
 * purchase price ("$10.42/mo", "36 monthly payments"). These are the listings
 * that made a $599 phone appear to cost $10.
 */
function isRecurringPrice(raw) {
  if (typeof raw !== 'string') return false;
  return /\/\s*(mo|month|wk|week|yr|year)\b|\bper\s+(month|week|year)\b|\bmonthly\b|\/mo\b/i.test(raw);
}

module.exports = { parsePrice, parseNumberToken, isRecurringPrice };
