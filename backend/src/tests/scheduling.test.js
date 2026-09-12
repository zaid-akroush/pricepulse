/**
 * Unit tests for the adaptive scheduler, the market table, the trends
 * aggregation and the savings timeline. All pure functions: no database.
 */
const {
  computeCheckIntervalHours, recentVolatilityPct, hasNearTarget, scheduleFor, queryKey, MIN_HOURS, MAX_HOURS,
} = require('../services/scheduling');
const { resolveMarket, isValidMarket, MARKETS } = require('../services/markets');
const { computeTrends, sparkline, windowEndpoints } = require('../services/trends');
const { savingsTimeline, toUsd } = require('../services/analytics');
const { pickPriceFor, sameProduct, isAccessoryListing } = require('../services/serpApi');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-12T12:00:00Z');
const at = (daysAgo, price) => ({ price, recordedAt: new Date(NOW - daysAgo * DAY) });

describe('computeCheckIntervalHours', () => {
  test('a product nobody tracks is checked at the maximum interval', () => {
    expect(computeCheckIntervalHours({ trackerCount: 0 })).toBe(MAX_HOURS);
  });
  test('one or two trackers: twice a day', () => {
    expect(computeCheckIntervalHours({ trackerCount: 1 })).toBe(12);
    expect(computeCheckIntervalHours({ trackerCount: 2 })).toBe(12);
  });
  test('three or more trackers: every six hours', () => {
    expect(computeCheckIntervalHours({ trackerCount: 3 })).toBe(6);
    expect(computeCheckIntervalHours({ trackerCount: 40 })).toBe(6);
  });
  test('recent movement tightens the interval', () => {
    expect(computeCheckIntervalHours({ trackerCount: 1, volatilityPct: 3 })).toBe(6);
    expect(computeCheckIntervalHours({ trackerCount: 1, volatilityPct: 9 })).toBe(MIN_HOURS);
  });
  test('a near target tightens the interval only when someone is tracking', () => {
    expect(computeCheckIntervalHours({ trackerCount: 1, nearTarget: true })).toBe(MIN_HOURS);
    expect(computeCheckIntervalHours({ trackerCount: 0, nearTarget: true })).toBe(MAX_HOURS);
  });
  test('never leaves the configured bounds', () => {
    expect(computeCheckIntervalHours({ trackerCount: 99, volatilityPct: 99, nearTarget: true })).toBe(MIN_HOURS);
  });
});

describe('recentVolatilityPct', () => {
  test('is the largest step between consecutive observations in the window', () => {
    const h = [at(10, 1000), at(5, 950), at(1, 1045)]; // -5 %, +10 %
    expect(recentVolatilityPct(h, NOW)).toBeCloseTo(10, 5);
  });
  test('ignores movement older than the window', () => {
    const h = [at(40, 500), at(20, 1000), at(1, 1000)];
    expect(recentVolatilityPct(h, NOW)).toBe(0);
  });
  test('handles unsorted input and fewer than two points', () => {
    expect(recentVolatilityPct([at(1, 100)], NOW)).toBe(0);
    expect(recentVolatilityPct([at(1, 110), at(3, 100)], NOW)).toBeCloseTo(10, 5);
  });
});

describe('hasNearTarget', () => {
  test('absolute target within 10 % of the current price', () => {
    expect(hasNearTarget([{ targetPrice: 900 }], 950, 1200)).toBe(true);
    expect(hasNearTarget([{ targetPrice: 800 }], 950, 1200)).toBe(false);
  });
  test('already met counts as near', () => {
    expect(hasNearTarget([{ targetPrice: 1000 }], 950, 1200)).toBe(true);
  });
  test('percentage target within 5 points of being met', () => {
    // 1200 -> 950 is a 20.8 % drop; a 25 % target is near, a 40 % one is not
    expect(hasNearTarget([{ targetDropPercent: 25 }], 950, 1200)).toBe(true);
    expect(hasNearTarget([{ targetDropPercent: 40 }], 950, 1200)).toBe(false);
  });
  test('no trackers, no target', () => {
    expect(hasNearTarget([], 950, 1200)).toBe(false);
    expect(hasNearTarget([{ targetPrice: null, targetDropPercent: null }], 950, 1200)).toBe(false);
  });
});

describe('scheduleFor and queryKey', () => {
  test('returns a due time in the future by the chosen interval', () => {
    const r = scheduleFor({ product: { currentPrice: 100, highestPrice: 100 }, items: [{}], history: [], now: NOW });
    expect(r.hours).toBe(12);
    expect(r.nextCheckAt.getTime()).toBe(NOW + 12 * 60 * 60 * 1000);
  });
  test('groups the same query in the same market regardless of case and spacing', () => {
    expect(queryKey(' iPhone 15 ', 'US')).toBe(queryKey('iphone 15', 'us'));
    expect(queryKey('iphone 15', 'us')).not.toBe(queryKey('iphone 15', 'hu'));
  });
});

describe('markets', () => {
  test('resolves known codes case-insensitively and falls back to the default', () => {
    expect(resolveMarket('HU').currency).toBe('HUF');
    expect(resolveMarket('nope').code).toBe('us');
    expect(resolveMarket(undefined).code).toBe('us');
  });
  test('validation is strict where resolution is lenient', () => {
    expect(isValidMarket('hu')).toBe(true);
    expect(isValidMarket('zz')).toBe(false);
    expect(isValidMarket('')).toBe(false);
  });
  test('every market currency is one the currency service can convert', () => {
    const { SUPPORTED } = require('../services/currency');
    for (const m of MARKETS) expect(SUPPORTED).toContain(m.currency);
  });
});

describe('pickPriceFor', () => {
  const results = [
    { title: 'Samsung Galaxy S24 Ultra 256GB Black', price: 899 },
    { title: 'Samsung Galaxy S24 Ultra 512GB Black', price: 1099 },
    { title: 'Samsung Galaxy S24 Ultra 512GB Titanium Gray', price: 1049 },
    { title: 'Case for Galaxy S24 Ultra 512GB', price: 12 },
  ];
  test('takes the cheapest listing of the SAME variant', () => {
    expect(pickPriceFor(results, 'Samsung Galaxy S24 Ultra 512GB')).toBe(1049);
  });
  test('returns null when nothing matches', () => {
    expect(pickPriceFor(results, 'Google Pixel 9 Pro 256GB')).toBeNull();
    expect(pickPriceFor([], 'anything')).toBeNull();
  });
  test('a listing at a small fraction of the known price is not the product', () => {
    const r = [{ title: 'iPhone 15 128GB Blue', price: 40 }, { title: 'iPhone 15 128GB Black', price: 700 }];
    expect(pickPriceFor(r, 'iPhone 15 128GB', 750)).toBe(700);
    expect(pickPriceFor(r, 'iPhone 15 128GB')).toBe(40); // no known price: no ratio guard
  });
});

describe('accessory detection', () => {
  test.each([
    'Case for Galaxy S24 Ultra 512GB',
    'Spigen Tough Armor Case Compatible with Galaxy S24 Ultra',
    'Screen Protector for iPhone 15 128GB',
    'USB-C Charger for MacBook Air M2',
    'Sport Band Compatible with Apple Watch Series 9 45mm',
  ])('treats "%s" as an accessory', (t) => {
    expect(isAccessoryListing(t)).toBe(true);
  });
  test.each([
    'Apple AirPods Pro 2 with MagSafe Charging Case (USB-C)',
    'Apple Watch Series 9 45mm GPS Aluminum Case with Sport Band',
    'Dell S2722QC 27 4K USB-C Monitor with Adjustable Stand',
    'Sony WH-1000XM5 Wireless Headphones with Carrying Case',
    'MacBook Air M2 13 8GB 256GB with 30W USB-C Power Adapter',
    'iPhone 15 128GB Black Unlocked',
  ])('does not mistake "%s" for an accessory', (t) => {
    expect(isAccessoryListing(t)).toBe(false);
  });
  test('an accessory never matches the product it is for, but products keep matching', () => {
    expect(sameProduct('Samsung Galaxy S24 Ultra 512GB', 'Case for Galaxy S24 Ultra 512GB')).toBe(false);
    expect(sameProduct('Apple AirPods Pro 2', 'Apple AirPods Pro 2 with MagSafe Charging Case (USB-C)')).toBe(true);
    // and a tracked accessory still matches accessory listings
    expect(sameProduct('Case for iPhone 15', 'Silicone Case for iPhone 15 Black')).toBe(true);
  });
});

describe('trends', () => {
  const products = [
    { id: 1, title: 'A', currency: 'USD', currentPrice: 90, lowestPrice: 90, highestPrice: 100, wishlistCount: 2,
      priceHistory: [at(10, 100), at(5, 95), at(1, 90)] },
    { id: 2, title: 'B', currency: 'USD', currentPrice: 110, lowestPrice: 100, highestPrice: 110, wishlistCount: 0,
      priceHistory: [at(10, 100), at(1, 110)] },
    { id: 3, title: 'C', currency: 'USD', currentPrice: 50, lowestPrice: 50, highestPrice: 50, wishlistCount: 0,
      priceHistory: [at(1, 50)] }, // one point: cannot be trended
  ];
  test('classifies drops and rises over the window', () => {
    const t = computeTrends(products, 7, NOW);
    expect(t.summary.productsObserved).toBe(2);
    expect(t.biggestDrops.map(r => r.id)).toEqual([1]);
    expect(t.biggestRises.map(r => r.id)).toEqual([2]);
    expect(t.atAllTimeLow.map(r => r.id)).toEqual([1]);
    // window opened 7 days ago: start price is the last observation before it (100)
    expect(t.biggestDrops[0].changePct).toBeCloseTo(-10, 1);
  });
  test('window start uses the observation at or before the window opens', () => {
    expect(windowEndpoints([at(10, 100), at(1, 90)], NOW - 7 * DAY)).toEqual({ start: 100, end: 90 });
    expect(windowEndpoints([at(3, 100), at(1, 90)], NOW - 7 * DAY)).toEqual({ start: 100, end: 90 });
  });
  test('sparkline downsamples evenly and keeps the endpoints', () => {
    const hist = Array.from({ length: 100 }, (_, i) => at(100 - i, i));
    const sp = sparkline(hist, 10);
    expect(sp).toHaveLength(10);
    expect(sp[0]).toBe(0);
    expect(sp[9]).toBe(99);
    expect(sparkline(hist.slice(0, 3), 10)).toEqual([0, 1, 2]);
  });
});

describe('savings timeline', () => {
  test('saved is peak-so-far minus price, never using future observations', () => {
    const items = [{ currency: 'USD', priceHistory: [at(4, 100), at(2, 80), at(1, 120)] }];
    const s = savingsTimeline(items, 5, null, NOW);
    expect(s).toHaveLength(5);
    // day -4: first observation, price 100, peak 100, saved 0
    expect(s[0]).toMatchObject({ value: 100, saved: 0, tracked: 1 });
    // day -2: price 80, peak 100, saved 20
    expect(s[2]).toMatchObject({ value: 80, saved: 20, tracked: 1 });
    // day -1 and today: price 120 is the new peak, saved 0
    expect(s[4]).toMatchObject({ value: 120, saved: 0, tracked: 1 });
  });
  test('products with no observation yet are not counted on that day', () => {
    const items = [{ currency: 'USD', priceHistory: [at(1, 50)] }];
    const s = savingsTimeline(items, 3, null, NOW);
    expect(s[0].tracked).toBe(0);
    expect(s[2].tracked).toBe(1);
  });
  test('converts other currencies into USD when rates are given', () => {
    const rates = { USD: 1, HUF: 400 };
    expect(toUsd(4000, 'HUF', rates)).toBe(10);
    expect(toUsd(10, 'XXX', rates)).toBe(10);
    const items = [{ currency: 'HUF', priceHistory: [at(1, 40000)] }];
    expect(savingsTimeline(items, 1, rates, NOW)[0].value).toBe(100);
  });
});
