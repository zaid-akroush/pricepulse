// Validation and moderation rules for community notes (Comment rows).
//
// Notes are user-generated text shown publicly on a product page, so they get
// checked before they're stored, not after. Everything here is deliberately
// deterministic and dependency-free: the same text always produces the same
// verdict, and the rules can be unit-tested without a database or a network
// call. Each check returns a short, human-readable reason so the UI can tell
// the poster exactly what to change instead of a generic "invalid" error.

const MIN_LENGTH = 10;
const MAX_LENGTH = 500;

// How many notes one user may post in a rolling window, and how long an
// identical note is blocked for. Enforced by the route (needs the DB), the
// numbers live here so all the note rules are in one place.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Deliberately a small, explicit list of slurs and hard profanity rather than
// a sprawling wordlist: a big list produces false positives (the Scunthorpe
// problem) on ordinary product talk, and this is a price-tracking site, not a
// general forum. Matched on word boundaries against a de-obfuscated copy of
// the text, so "s h i t" and "sh1t" are caught too.
const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'dick', 'piss',
  'slut', 'whore', 'faggot', 'nigger', 'nigga', 'retard', 'rape', 'kys',
];

// Common letter-for-symbol substitutions, collapsed before matching so
// "f*ck", "sh!t" and "@sshole" don't slip through.
const LEETSPEAK = { '4': 'a', '@': 'a', '8': 'b', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't' };

function deobfuscate(text) {
  const lowered = text.toLowerCase();
  let out = '';
  for (const ch of lowered) out += LEETSPEAK[ch] !== undefined ? LEETSPEAK[ch] : ch;
  // Strip zero-width and other invisible characters outright: they are never
  // legitimate in a note and were being used to split a banned word
  // ("f\u200Buck") in a way that survived every later check.
  out = out.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
  // Then collapse ANY run of non-alphanumerics to a single space. The old
  // version listed specific separators, so "f/u/c/k" walked straight through.
  return out.replace(/[^a-z0-9]+/g, ' ');
}

// Build a pattern for one banned word that also matches the common censored
// spellings ("f*ck", "sh!t", "a$$hole") and separator-padded ones ("f.u.c.k").
// Only vowels are allowed to be replaced by a censor symbol — letting every
// character be a wildcard would match far too much ordinary text.
const CENSOR_CHARS = '*#@!$%^&';
const VOWELS = 'aeiou';
function bannedWordPattern(word) {
  const escapedCensor = CENSOR_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chars = word
    .split('')
    .map(c => (VOWELS.includes(c) ? `[${c}${escapedCensor}]` : c))
    .join('[\\s._\\-]*');
  // A short trailing run of letters is allowed so inflections are caught
  // too ("f*cking", "shitty"), but not so many that unrelated longer
  // words get swept up.
  return new RegExp(`(^|[^a-z])${chars}[a-z]{0,3}([^a-z]|$)`, 'i');
}
const BANNED_PATTERNS = BANNED_WORDS.map(w => ({ word: w, re: bannedWordPattern(w) }));

// Innocent words that a banned-word pattern would otherwise swallow (the
// Scunthorpe problem). Stripped out before matching, so "Dickens box set"
// posts fine while "dickhead" still doesn't.
// Every alternative is fully spelled out and \b-anchored on both sides. An
// earlier version used `classic\w*` / `assassin\w*`, whose greedy \w* ate the
// banned word glued onto it — "classicfuck" was stripped to nothing and the
// note passed.
const ALLOWED_EXCEPTIONS = /\b(dickens|dickinson|dickson|dicker|dickey|shiitake|scunthorpe|cockburn|penistone|assassin|assassins|assassination|classic|classics|classical|classically)\b/gi;

function containsBannedWord(text) {
  text = String(text).replace(ALLOWED_EXCEPTIONS, ' ');
  const clean = deobfuscate(text);
  const squashed = clean.replace(/\s+/g, ''); // catches "f u c k"
  for (const { word, re } of BANNED_PATTERNS) {
    if (re.test(text) || re.test(clean)) return true;
    if (squashed.includes(word)) return true;
  }
  return false;
}

// Any scheme, any www host, or any bare domain with a 2+ letter TLD. The
// previous version allowlisted ~10 TLDs, so "bit.ly/abc", "dealsite.de" and
// "wa.me/1555…" all posted fine. Matching every TLD risks the odd false
// positive on a sentence like "great value.no idea why" — acceptable, since
// the error message tells the poster exactly what tripped.
const URL_RE = /(https?:\/\/|\bwww\.)\S+|\b[a-z0-9][a-z0-9-]*\.[a-z]{2,24}(\/\S*)?\b/i;
// 7+ digits in a row, or a formatted phone number.
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

/**
 * Check a note before it's stored.
 * @param {string} raw the text as typed
 * @returns {{ok: boolean, text?: string, error?: string}}
 *   `text` is the normalised value to persist; `error` is a message safe to
 *   show the poster verbatim.
 */
function validateNoteText(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Note text is required.' };

  // Collapse runs of whitespace/newlines so a note padded out to the minimum
  // length with blank lines doesn't pass, and so stored text renders sanely.
  const text = raw.replace(/\s+/g, ' ').trim();

  if (!text) return { ok: false, error: 'Note text is required.' };
  if (text.length < MIN_LENGTH) {
    return { ok: false, error: `Notes must be at least ${MIN_LENGTH} characters — add a little detail so it's useful to others.` };
  }
  if (text.length > MAX_LENGTH) {
    return { ok: false, error: `Notes must be ${MAX_LENGTH} characters or fewer (yours is ${text.length}).` };
  }

  if (containsBannedWord(text)) {
    return { ok: false, error: 'Please keep notes civil — that wording isn\'t allowed here.' };
  }

  if (URL_RE.test(text)) {
    return { ok: false, error: 'Links aren\'t allowed in notes. Describe the deal instead of linking to it.' };
  }
  if (PHONE_RE.test(text)) {
    return { ok: false, error: 'Please don\'t post phone numbers or contact details.' };
  }

  // ── Spam heuristics ─────────────────────────────────────────────────────
  const letters = text.replace(/[^a-z]/gi, '');

  // SHOUTING. Only judged once there's enough text for the ratio to mean
  // something, so short notes like "OLED TV" aren't flagged.
  if (letters.length >= 20) {
    const upper = (text.match(/[A-Z]/g) || []).length;
    if (upper / letters.length > 0.7) {
      return { ok: false, error: 'Please don\'t write in all caps.' };
    }
  }

  // "greeeeeeat", "!!!!!!!!" — 5+ of the same character in a row.
  if (/(.)\1{4,}/.test(text)) {
    return { ok: false, error: 'That looks like spam (a character repeated too many times).' };
  }

  // The same word over and over ("buy buy buy buy").
  const words = text.toLowerCase().split(' ').filter(Boolean);
  if (words.length >= 6) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.4) {
      return { ok: false, error: 'That looks like spam (too much repetition).' };
    }
  }

  // Almost no letters at all: emoji walls, "!!!???", "..........".
  if (letters.length < text.length * 0.4) {
    return { ok: false, error: 'Notes need to be mostly words so others can read them.' };
  }

  return { ok: true, text };
}

// Shown in the UI so the rules are visible before someone hits Post, rather
// than only as an error after.
const NOTE_GUIDELINES = [
  `Between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`,
  'Be helpful and civil — no profanity, slurs or personal attacks.',
  'No links, phone numbers or contact details.',
  'No spam: no all-caps, repeated characters or repeated words.',
  `Up to ${RATE_LIMIT_MAX} notes every ${RATE_LIMIT_WINDOW_MS / 60000} minutes, and no duplicate notes.`,
];

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  DUPLICATE_WINDOW_MS,
  NOTE_GUIDELINES,
  validateNoteText,
  containsBannedWord,
};
