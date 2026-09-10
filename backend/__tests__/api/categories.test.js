'use strict';

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db/prismaClient');
const redis = require('../../src/redis/client');

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

describe('GET /api/categories', () => {
  it('debe devolver 200 con la lista de categorías', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('cada categoría debe tener los campos esperados', async () => {
    const res = await request(app).get('/api/categories');

    // El seed insertó al menos 1 categoría (Tecnología)
    expect(res.body.categories.length).toBeGreaterThan(0);

    const cat = res.body.categories[0];
    expect(cat).toHaveProperty('id');
    expect(cat).toHaveProperty('name');
    expect(cat).toHaveProperty('crosswordCount');
    expect(typeof cat.crosswordCount).toBe('number');
  });
});
