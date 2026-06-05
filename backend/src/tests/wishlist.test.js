const request = require('supertest');
const app = require('../app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let token;
let wishlistItemId;

const testProduct = {
  title: 'Test Headphones',
  currentPrice: 199.99,
  currency: 'USD',
  serpApiQuery: 'test headphones',
};

beforeAll(async () => {
  // Clean up
  await prisma.user.deleteMany({ where: { email: 'wishlist@test.pricepulse' } });

  // Register and get token
  const res = await request(app).post('/api/auth/register').send({
    name: 'Wishlist User',
    email: 'wishlist@test.pricepulse',
    password: 'password123',
  });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'wishlist@test.pricepulse' } });
  await prisma.$disconnect();
});

describe('GET /api/wishlist', () => {
  it('returns empty wishlist for new user', async () => {
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/wishlist');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/wishlist', () => {
  it('adds a product to the wishlist', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .send(testProduct);
    expect(res.status).toBe(201);
    expect(res.body.product.title).toBe('Test Headphones');
    wishlistItemId = res.body.id;
  });

  it('does not duplicate the same product', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .send(testProduct);
    expect(res.status).toBe(201); // upsert — no error
    const list = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(1);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/wishlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No price' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/wishlist/:id', () => {
  it('updates the target price', async () => {
    const res = await request(app)
      .patch(`/api/wishlist/${wishlistItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPrice: 150 });
    expect(res.status).toBe(200);
    expect(res.body.targetPrice).toBe(150);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .patch('/api/wishlist/99999')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetPrice: 100 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/wishlist/:id', () => {
  it('removes item from wishlist', async () => {
    const res = await request(app)
      .delete(`/api/wishlist/${wishlistItemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const list = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBe(0);
  });

  it('returns 404 for already-deleted item', async () => {
    const res = await request(app)
      .delete(`/api/wishlist/${wishlistItemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
