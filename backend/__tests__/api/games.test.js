'use strict';

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/db/prismaClient');
const redis = require('../../src/redis/client');
const { deleteGameState } = require('../../src/redis/gameState');

let categoryId;
const createdGameIds = [];

// Obtener la primera categoría disponible (creada por el seed)
beforeAll(async () => {
  const cat = await prisma.category.findFirst();
  if (!cat) throw new Error('No hay categorías en la DB. Ejecuta el seed primero.');
  categoryId = cat.id;
});

// Limpiar partidas creadas durante los tests
afterAll(async () => {
  for (const id of createdGameIds) {
    await deleteGameState(id);
    await prisma.game.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
  await redis.quit();
});

// ─── POST /api/games ─────────────────────────────────────────────────────────

describe('POST /api/games — casos válidos', () => {
  it('debe crear una partida FREE y devolver 201 con gameId y shareUrl', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'FREE' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('gameId');
    expect(res.body).toHaveProperty('shareUrl');
    expect(res.body.shareUrl).toBe(`/play/${res.body.gameId}`);
    expect(res.body.mode).toBe('FREE');
    expect(res.body.status).toBe('WAITING');

    createdGameIds.push(res.body.gameId);
  });

  it('debe crear una partida TIMED con duration y devolver 201', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'TIMED', duration: 120 });

    expect(res.statusCode).toBe(201);
    expect(res.body.mode).toBe('TIMED');
    expect(res.body.duration).toBe(120);
    expect(res.body).toHaveProperty('crossword');

    createdGameIds.push(res.body.gameId);
  });
});

describe('POST /api/games — casos de error', () => {
  it('debe devolver 400 si falta categoryId', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ mode: 'FREE' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('debe devolver 400 si mode es inválido', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'INVALIDO' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('debe devolver 400 si mode es TIMED pero falta duration', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'TIMED' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('debe devolver 404 si categoryId no existe', async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId: 'id-que-no-existe-99999', mode: 'FREE' });

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── GET /api/games/:gameId ───────────────────────────────────────────────────

describe('GET /api/games/:gameId', () => {
  let testGameId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'FREE' });
    testGameId = res.body.gameId;
    createdGameIds.push(testGameId);
  });

  it('debe devolver 200 con la metadata de la partida', async () => {
    const res = await request(app).get(`/api/games/${testGameId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.gameId).toBe(testGameId);
    expect(res.body).toHaveProperty('mode');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('crossword');
    expect(res.body).toHaveProperty('players');
    expect(Array.isArray(res.body.players)).toBe(true);
  });

  it('debe devolver 404 si el gameId no existe', async () => {
    const res = await request(app).get('/api/games/id-inexistente-xyz-000');

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
