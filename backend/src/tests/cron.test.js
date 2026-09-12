/**
 * Integration test for the price sweep: real database, stubbed provider.
 *
 * The provider is replaced so no paid request is made; everything else
 * (recording, alert decision, rescheduling, query sharing) runs for real.
 */
jest.mock('../services/searchProviders', () => {
  const real = jest.requireActual('../services/searchProviders');
  return {
    ...real,
    fetchShopping: jest.fn(),
  };
});
jest.mock('../services/mailer', () => ({
  sendPriceDropEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { PrismaClient } = require('@prisma/client');
const { fetchShopping } = require('../services/searchProviders');
const { resetSearchCache } = require('../services/serpApi');
const { checkPrices, rescheduleProduct, observePrice } = require('../jobs/priceCron');
const { MAX_HOURS } = require('../services/scheduling');

const prisma = new PrismaClient();
const EMAIL = `cron-${Date.now()}@test.pricepulse`;
let user, tracked, untracked, sharedA, sharedB;

beforeAll(async () => {
  user = await prisma.user.create({ data: { name: 'Cron Tester', email: EMAIL, password: 'x' } });
  const mk = (title, query, price, country = 'us') => prisma.product.create({
    data: {
      title, serpApiQuery: query, country, currentPrice: price, lowestPrice: price, highestPrice: price,
      source: 'test', nextCheckAt: new Date(0),
      priceHistory: { create: { price } },
    },
  });
  tracked = await mk('Test Phone Cron 512GB', 'test phone cron', 1000);
  untracked = await mk('Test Tablet Cron 256GB', 'test tablet cron', 500);
  sharedA = await mk('Test Laptop Cron 16GB', 'test laptop cron', 1200);
  sharedB = await mk('Test Laptop Cron 32GB', 'test laptop cron', 1500);
  await prisma.wishlistItem.create({ data: { userId: user.id, productId: tracked.id, targetPrice: 900 } });
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: [tracked.id, untracked.id, sharedA.id, sharedB.id] } } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

beforeEach(() => {
  resetSearchCache();
  fetchShopping.mockReset();
});

function listings(query) {
  const by = {
    'test phone cron': [
      { title: 'Test Phone Cron 512GB', price: '$880.00', url: 'https://example.com/p', source: 'Shop' },
      { title: 'Case for Test Phone Cron 512GB', price: '$9.00', url: 'https://example.com/c', source: 'Shop' },
    ],
    'test tablet cron': [{ title: 'Test Tablet Cron 256GB', price: '$500.00', url: 'https://example.com/t', source: 'Shop' }],
    'test laptop cron': [
      { title: 'Test Laptop Cron 16GB', price: '$1,150.00', url: 'https://example.com/l16', source: 'Shop' },
      { title: 'Test Laptop Cron 32GB', price: '$1,450.00', url: 'https://example.com/l32', source: 'Shop' },
    ],
  };
  return { provider: 'stub', items: by[query.toLowerCase()] || [] };
}

describe('checkPrices', () => {
  it('records prices, alerts on a target hit, and reschedules every due product', async () => {
    fetchShopping.mockImplementation(async (q) => listings(q));

    const result = await checkPrices();
    expect(result.ran).toBe(true);
    expect(result.due).toBeGreaterThanOrEqual(4);

    // Two products share one query: three distinct queries, four products.
    const ourQueries = fetchShopping.mock.calls.map(c => c[0].toLowerCase()).filter(q => q.startsWith('test '));
    expect(new Set(ourQueries).size).toBe(3);
    expect(ourQueries.filter(q => q === 'test laptop cron')).toHaveLength(1);

    const phone = await prisma.product.findUnique({ where: { id: tracked.id }, include: { priceHistory: true, wishlistItems: true } });
    expect(phone.currentPrice).toBe(880);           // the case at $9 was not mistaken for the phone
    expect(phone.lowestPrice).toBe(880);
    expect(phone.priceHistory).toHaveLength(2);
    expect(phone.wishlistItems[0].notified).toBe(true);
    expect(phone.wishlistItems[0].notifiedTargetAt).not.toBeNull();
    expect(phone.nextCheckAt.getTime()).toBeGreaterThan(Date.now());
    // 12 % move with one tracker whose target is met: tightest interval.
    expect(phone.checkIntervalHours).toBe(3);

    const alert = await prisma.notification.findFirst({ where: { userId: user.id, productId: tracked.id } });
    expect(alert).not.toBeNull();
    expect(alert.type).toBe('target_hit');

    const tablet = await prisma.product.findUnique({ where: { id: untracked.id } });
    expect(tablet.checkIntervalHours).toBe(MAX_HOURS);
    expect(tablet.nextCheckAt.getTime()).toBeGreaterThan(Date.now());

    const l16 = await prisma.product.findUnique({ where: { id: sharedA.id } });
    const l32 = await prisma.product.findUnique({ where: { id: sharedB.id } });
    expect(l16.currentPrice).toBe(1150);
    expect(l32.currentPrice).toBe(1450);
  });

  it('skips products that are not due yet', async () => {
    fetchShopping.mockImplementation(async (q) => listings(q));
    const result = await checkPrices();
    expect(result.due).toBe(0);
    expect(fetchShopping.mock.calls.filter(c => c[0].toLowerCase().startsWith('test '))).toHaveLength(0);
  });

  it('re-checks everything when asked to, and does not alert twice for the same move', async () => {
    fetchShopping.mockImplementation(async (q) => listings(q));
    const before = await prisma.notification.count({ where: { userId: user.id } });
    const result = await checkPrices({ all: true });
    expect(result.due).toBeGreaterThanOrEqual(4);
    const after = await prisma.notification.count({ where: { userId: user.id } });
    expect(after).toBe(before);
  });

  it('stops early and leaves schedules untouched when the provider rejects the key', async () => {
    await prisma.product.updateMany({ where: { id: { in: [tracked.id, untracked.id] } }, data: { nextCheckAt: new Date(0) } });
    const err = new Error('bad key'); err.response = { status: 403, data: {} };
    fetchShopping.mockRejectedValue(err);
    const result = await checkPrices();
    expect(result.updated).toBe(0);
    const phone = await prisma.product.findUnique({ where: { id: tracked.id } });
    expect(phone.nextCheckAt.getTime()).toBe(0); // still due next tick
  });

  it('does not record a stale cached search as a new observation', async () => {
    // Prime the cache through a normal browse (default TTL), then age it.
    fetchShopping.mockImplementation(async (q) => listings(q));
    const { searchProducts } = require('../services/serpApi');
    await searchProducts('test tablet cron', { techOnly: false, country: 'us' });
    const tabletCalls = () => fetchShopping.mock.calls.filter(c => c[0].toLowerCase() === 'test tablet cron').length;
    expect(tabletCalls()).toBe(1);
    await prisma.product.update({ where: { id: untracked.id }, data: { nextCheckAt: new Date(0) } });
    const before = await prisma.priceHistory.count({ where: { productId: untracked.id } });
    // Sweep insists on a result no older than OBSERVATION_MAX_AGE_MS (1 h):
    // the cached one is younger than that, so it is reused, and one more
    // history row is written from a real (recent) answer.
    await checkPrices();
    expect(tabletCalls()).toBe(1);
    expect(await prisma.priceHistory.count({ where: { productId: untracked.id } })).toBe(before + 1);
  });

  it('observePrice records, alerts trackers and reschedules like the sweep', async () => {
    // Drop the tracked phone further; a fresh drop alert must fire from the
    // manual/view path, not only from the scheduled sweep.
    await prisma.wishlistItem.updateMany({ where: { productId: tracked.id }, data: { notified: false, notifiedTargetAt: null, targetPrice: 500 } });
    resetSearchCache();
    fetchShopping.mockImplementation(async () => ({ provider: 'stub', items: [
      { title: 'Test Phone Cron 512GB', price: '$800.00', url: 'https://example.com/p', source: 'Shop' },
    ] }));
    const before = await prisma.notification.count({ where: { userId: user.id, productId: tracked.id } });
    const r = await observePrice(tracked.id);
    expect(r.price).toBe(800);
    expect(r.alerts).toBe(1); // 880 -> 800 is a 9 % drop
    const after = await prisma.notification.count({ where: { userId: user.id, productId: tracked.id } });
    expect(after).toBe(before + 1);
    const phone = await prisma.product.findUnique({ where: { id: tracked.id } });
    expect(phone.currentPrice).toBe(800);
    expect(phone.nextCheckAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('two concurrent observations of one product yield one history row and one alert', async () => {
    await prisma.wishlistItem.updateMany({ where: { productId: tracked.id }, data: { notified: false, notifiedTargetAt: null, targetPrice: 300 } });
    resetSearchCache();
    fetchShopping.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50)); // slow provider: both callers overlap
      return { provider: 'stub', items: [{ title: 'Test Phone Cron 512GB', price: '$700.00', url: 'https://example.com/p', source: 'Shop' }] };
    });
    const rows = await prisma.priceHistory.count({ where: { productId: tracked.id } });
    const alerts = await prisma.notification.count({ where: { userId: user.id, productId: tracked.id } });
    const [a, b] = await Promise.all([observePrice(tracked.id), observePrice(tracked.id)]);
    expect([a.price, b.price].filter(p => p === 700)).toHaveLength(1);
    expect(await prisma.priceHistory.count({ where: { productId: tracked.id } })).toBe(rows + 1);
    expect(await prisma.notification.count({ where: { userId: user.id, productId: tracked.id } })).toBe(alerts + 1);
  });

  it('rescheduleProduct never pushes an already-due product further out', async () => {
    await prisma.product.update({ where: { id: untracked.id }, data: { nextCheckAt: new Date(0) } });
    const r = await rescheduleProduct(untracked.id);
    expect(r.hours).toBe(MAX_HOURS);
    const p = await prisma.product.findUnique({ where: { id: untracked.id } });
    expect(p.nextCheckAt.getTime()).toBe(0);
  });
});
