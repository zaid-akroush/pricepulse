const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/products/search', () => {
  it('rejects missing query param', async () => {
    const res = await request(app).get('/api/products/search');
    expect(res.status).toBe(400);
  });

  // Note: full search test requires a live SerpApi key — skipped in CI
  it.skip('returns results for a valid query', async () => {
    const res = await request(app).get('/api/products/search?q=headphones');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/products/:id', () => {
  it('returns 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/99999');
    expect(res.status).toBe(404);
  });
});
