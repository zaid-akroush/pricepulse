/**
 * Unit tests for the pure decision logic: price parsing, product matching,
 * category classification, release detection and note moderation.
 *
 * These functions have no database, network or framework dependency, which is
 * exactly why they are worth pinning down: they decide what a price *is*,
 * whether two listings are the same product, and whether a note is publishable.
 * A wrong answer here is silent — it produces a plausible number or verdict
 * that nothing downstream questions.
 *
 * Every case below corresponds to a real defect that was found and fixed, or
 * to a boundary that must not regress. Where a case documents a specific bug,
 * the comment says what the old behaviour was.
 */

const { parsePrice, parseNumberToken, isRecurringPrice } = require('../services/priceParse');
const { isTechProduct, getReleaseStatus } = require('../services/productClassifier');
const { validateNoteText, MIN_LENGTH, MAX_LENGTH } = require('../services/noteModeration');

describe('parsePrice', () => {
  describe('formats that must parse correctly', () => {
    const cases = [
      ['$1,099.99', 1099.99, 'US thousands separator'],
      ['$1,299', 1299, 'US, no decimals'],
      ['999', 999, 'bare number'],
      ['$0.99', 0.99, 'sub-dollar'],
      ['From $99', 99, 'prefixed with words'],
      ['€1.299,00', 1299, 'European: dot groups, comma decimal'],
      ['1.099,99 €', 1099.99, 'European, suffixed symbol'],
      ['US$ 1 099,99', 1099.99, 'space as thousands separator'],
      ['₹1,09,999', 109999, 'Indian digit grouping'],
      ['1 234,56', 1234.56, 'space group + comma decimal'],
    ];
    test.each(cases)('parses %s as %p (%s)', (input, expected) => {
      expect(parsePrice(input)).toBe(expected);
    });
  });

  describe('ambiguous input is refused rather than guessed', () => {
    // The old parser stripped everything except digits and dots, which
    // CONCATENATED numbers instead of failing:
    //   "$12.99 - $15.99"             -> 12.9915
    //   "Now $1,199.00 was $1,399.00" -> 1199.001399
    // A refused listing is recoverable. A wrong price written into price
    // history is not, because highestPrice only ever ratcheted upward.
    const cases = [
      ['$12.99 - $15.99', 'a price range'],
      ['Now $1,199.00 was $1,399.00', 'a was/now pair'],
      ['$10 to $20', 'a spelled-out range'],
    ];
    test.each(cases)('refuses %s (%s)', (input) => {
      expect(parsePrice(input)).toBeNull();
    });
  });

  describe('non-prices', () => {
    test.each([
      ['free'],
      [''],
      ['   '],
      ['out of stock'],
      [null],
      [undefined],
      [{}],
    ])('returns null for %p', (input) => {
      expect(parsePrice(input)).toBeNull();
    });

    test('passes through a finite number unchanged', () => {
      expect(parsePrice(1099.99)).toBe(1099.99);
    });

    test('rejects a non-finite number', () => {
      expect(parsePrice(NaN)).toBeNull();
      expect(parsePrice(Infinity)).toBeNull();
    });
  });

  describe('regression: the 100x overstatement', () => {
    // "US$ 1 099,99" parsed to 109999 under the old implementation. Because
    // highestPrice was a one-way ratchet, that single reading permanently
    // pinned the product at ~99% below peak with a deal score of 100, putting
    // it at the top of every "best deal" list with no way to correct it.
    test('does not inflate a space-and-comma formatted price', () => {
      const parsed = parsePrice('US$ 1 099,99');
      expect(parsed).toBe(1099.99);
      expect(parsed).toBeLessThan(2000);
    });

    test('does not collapse a European price to a fraction', () => {
      // "€1.299,00" previously parsed to 1.299, which then fell below the
      // implausible-price floor and the listing was silently dropped.
      expect(parsePrice('€1.299,00')).toBe(1299);
    });
  });

  describe('parseNumberToken decimal-separator inference', () => {
    // The separator that appears LAST is the decimal one, but only when it is
    // followed by 1-2 digits. "1.099" is one thousand and ninety-nine.
    test.each([
      ['1.099', 1099, 'three trailing digits means a thousands separator'],
      ['1.09', 1.09, 'two trailing digits means a decimal separator'],
      ['1,5', 1.5, 'single trailing digit means a decimal separator'],
      ['1,099,999', 1099999, 'repeated separators are all grouping'],
    ])('%s -> %p (%s)', (input, expected) => {
      expect(parseNumberToken(input)).toBe(expected);
    });
  });
});

describe('isRecurringPrice', () => {
  // A monthly instalment is not the product's price. These listings are what
  // made a $599 phone appear in the comparison table at $10.42.
  test.each([
    ['$10.42/mo', true],
    ['$25 per month', true],
    ['$41.62/month', true],
    ['$599.00', false],
    ['$1,099.99', false],
  ])('%s -> %p', (input, expected) => {
    expect(isRecurringPrice(input)).toBe(expected);
  });
});

describe('isTechProduct', () => {
  describe('accepts consumer electronics', () => {
    test.each([
      ['Apple iPhone 17 Pro 256GB'],
      ['Sony WH-1000XM5 Wireless Headphones'],
      ['Samsung 65" QLED 4K TV'],
      ['NVIDIA GeForce RTX 5090 Graphics Card'],
      ['Anker 20000mAh Power Bank'],
      ['Dell XPS 15 Laptop'],
    ])('%s', (title) => {
      expect(isTechProduct(title)).toBe(true);
    });
  });

  describe('accepts product families whose names contain no category word', () => {
    // These all returned false at first, and because the filter also ran on
    // the price-refresh path, any product like this would have stopped
    // updating its price forever, silently, and vanished from its own search.
    test.each([
      ['Apple Watch Series 9 GPS 45mm'],
      ['Kindle Paperwhite 16GB'],
      ['Garmin Forerunner 265'],
      ['Anker PowerCore 10000'],
      ['Roomba j7+'],
      ['Meta Quest 3 128GB'],
    ])('%s', (title) => {
      expect(isTechProduct(title)).toBe(true);
    });
  });

  describe('rejects everything else', () => {
    // The motivating case: searching "china" returned dinnerware, and
    // searching "apple" returned fruit juice, because the shopping API simply
    // answers the query it is given.
    test.each([
      ['Noritake Charlotta 60-Piece Dinnerware Set'],
      ['Famille Rose 12-Piece Dinnerware Set'],
      ['Organic Apple Juice 1L'],
      ['Nike Air Max Sneakers'],
      ['LEGO Star Wars Millennium Falcon'],
    ])('%s', (title) => {
      expect(isTechProduct(title)).toBe(false);
    });
  });

  test('handles missing and malformed titles', () => {
    expect(isTechProduct(null)).toBe(false);
    expect(isTechProduct('')).toBe(false);
    expect(isTechProduct(123)).toBe(false);
  });
});

describe('getReleaseStatus', () => {
  test('flags explicit pre-orders', () => {
    const status = getReleaseStatus('Nothing Phone 3a Pro (Pre-Order)');
    expect(status.released).toBe(false);
    expect(status.reason).toBe('preorder');
    expect(status.label).toMatch(/not released/i);
  });

  test('flags a future model year', () => {
    // Injected clock so this test does not start failing in a future year.
    const status = getReleaseStatus('Samsung Galaxy S27 - 2027 model', new Date('2026-01-01'));
    expect(status.released).toBe(false);
    expect(status.reason).toBe('future_model_year');
    expect(status.label).toContain('2027');
  });

  test('treats a current-year model as released', () => {
    const status = getReleaseStatus('Sony WH-1000XM5 (2026)', new Date('2026-01-01'));
    expect(status.released).toBe(true);
  });

  describe('does not mistake shipping copy for a pre-order', () => {
    // "available from" and "ships from" are ordinary in-stock listing
    // boilerplate. Matching them labelled real, buyable products as unreleased.
    test.each([
      ['iPhone 15 Pro available from Verizon'],
      ['Samsung Galaxy S24 - ships from China'],
      ['Dell XPS 15 available on Amazon'],
    ])('%s', (title) => {
      expect(getReleaseStatus(title).released).toBe(true);
    });
  });

  test('handles an empty title', () => {
    expect(getReleaseStatus('').released).toBe(true);
    expect(getReleaseStatus(null).released).toBe(true);
  });
});

describe('validateNoteText', () => {
  const ok = (text) => validateNoteText(text).ok;

  describe('accepts genuine notes', () => {
    test.each([
      ['Picked this up last month and the price has already dropped twice.'],
      ['Build quality is solid for the money, no complaints after a few weeks.'],
      ['Watch out for the older generation being sold at a similar price.'],
    ])('%s', (text) => {
      expect(ok(text)).toBe(true);
    });

    test('normalises whitespace in the stored value', () => {
      const result = validateNoteText('  Great   value    for the money here  ');
      expect(result.ok).toBe(true);
      expect(result.text).toBe('Great value for the money here');
    });
  });

  describe('length bounds', () => {
    test(`rejects shorter than ${MIN_LENGTH} characters`, () => {
      expect(ok('too short')).toBe(false);
    });

    test('rejects whitespace padded out to the minimum', () => {
      // Collapsing whitespace BEFORE measuring is what makes this work.
      expect(ok('ok' + ' '.repeat(50))).toBe(false);
    });

    test(`accepts exactly ${MIN_LENGTH} characters`, () => {
      // Must be a realistic note, not 'aaaaaaaaaa' — a run of one repeated
      // character is caught by the spam rule below, and rightly so.
      const text = 'good value';
      expect(text).toHaveLength(MIN_LENGTH);
      expect(ok(text)).toBe(true);
    });

    test('a string of one repeated character is spam, not a valid short note', () => {
      expect(ok('a'.repeat(MIN_LENGTH))).toBe(false);
    });

    test(`rejects longer than ${MAX_LENGTH} characters`, () => {
      expect(ok('a'.repeat(MAX_LENGTH + 1))).toBe(false);
    });
  });

  describe('profanity, including evasions', () => {
    test.each([
      ['this is f*cking terrible quality honestly', 'symbol-censored'],
      ['what the sh!t is this pricing about', 'leetspeak'],
      ['what a d1ck move by this seller here', 'digit substitution'],
      ['this is f/u/c/k tier pricing honestly', 'arbitrary separators'],
      ['What a f​uck of a deal this turned out', 'zero-width character'],
      ['This classicfuck deal is honestly awful', 'glued to an allowlisted word'],
    ])('rejects %s (%s)', (text) => {
      expect(ok(text)).toBe(false);
    });

    describe('does not false-positive on innocent words', () => {
      // The Scunthorpe problem: an over-eager filter that blocks ordinary
      // product talk is worse than one that misses an insult.
      test.each([
        ['Dickens novels box set arrived quickly today'],
        ['Classic design and the price is fair right now'],
        ['Assessment of the battery life was very positive'],
        ['I bought a rubber duck for my desk setup here'],
      ])('%s', (text) => {
        expect(ok(text)).toBe(true);
      });
    });
  });

  describe('links and contact details', () => {
    // The old filter allowlisted about ten TLDs, so shorteners and
    // country domains posted freely.
    test.each([
      ['check http://spam.example.com for a better price'],
      ['check bit.ly/abc123 for an even better one'],
      ['live over at dealsite.de right now honestly'],
      ['Message me on wa.me/15551234 about this'],
      ['visit www.example.org for the real deal'],
    ])('rejects %s', (text) => {
      expect(ok(text)).toBe(false);
    });

    test('rejects a phone number', () => {
      expect(ok('call me on 555 123 4567 about this deal')).toBe(false);
    });
  });

  describe('spam heuristics', () => {
    test('rejects shouting', () => {
      expect(ok('THIS IS AN AMAZING DEAL EVERYONE SHOULD BUY IT NOW')).toBe(false);
    });

    test('allows a short run of caps in an otherwise normal note', () => {
      // Acronyms are normal in electronics talk and must not trip the filter.
      expect(ok('The OLED panel on this TV is genuinely excellent')).toBe(true);
    });

    test('rejects a character repeated many times', () => {
      expect(ok('soooooooooo good, I really loved it')).toBe(false);
    });

    test('rejects word repetition', () => {
      expect(ok('buy buy buy buy buy buy buy now')).toBe(false);
    });

    test('rejects a wall of emoji', () => {
      expect(ok('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥')).toBe(false);
    });
  });

  describe('error messages', () => {
    test('names the rule that was broken, for showing to the poster', () => {
      expect(validateNoteText('hi').error).toMatch(/at least/i);
      expect(validateNoteText('check http://x.example.com for more').error).toMatch(/link/i);
      expect(validateNoteText('BUY THIS RIGHT NOW EVERYONE SERIOUSLY').error).toMatch(/caps/i);
    });
  });

  describe('non-string input', () => {
    test.each([[null], [undefined], [42], [{}], [[]]])('rejects %p', (input) => {
      expect(validateNoteText(input).ok).toBe(false);
    });
  });
});
