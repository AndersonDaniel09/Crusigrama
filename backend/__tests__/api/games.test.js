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

// ─── POST /api/games/:gameId/join ─────────────────────────────────────────────

describe('POST /api/games/:gameId/join', () => {
  let joinGameId;

  // Crear una partida fresca para cada suite de join
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'FREE' });
    joinGameId = res.body.gameId;
    createdGameIds.push(joinGameId);
  });

  it('debe unirse exitosamente y devolver 201 con token y crossword', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: 'Ana' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('playerId');
    expect(res.body).toHaveProperty('token');
    expect(res.body.name).toBe('Ana');
    expect(res.body.gameId).toBe(joinGameId);
    expect(res.body).toHaveProperty('crossword');
    expect(Array.isArray(res.body.crossword.words)).toBe(true);
  });

  it('el crossword NO debe incluir las respuestas correctas (word)', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: 'Luis' });

    expect(res.statusCode).toBe(201);
    // Cada palabra debe tener length pero NO el campo 'word'
    const word = res.body.crossword.words[0];
    expect(word).toHaveProperty('length');
    expect(word).not.toHaveProperty('word');
    expect(word).toHaveProperty('clue');
    expect(word).toHaveProperty('direction');
    expect(word).toHaveProperty('row');
    expect(word).toHaveProperty('col');
  });

  it('debe devolver 409 si el nombre ya está en uso en la partida', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: 'Ana' }); // Ana ya se unió antes

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('debe devolver 409 con nombre duplicado en diferente capitalización', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: 'ana' }); // mismo nombre, diferente capitalización

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('debe devolver 400 si el name está vacío', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: '' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debe devolver 400 si el name es solo espacios', async () => {
    const res = await request(app)
      .post(`/api/games/${joinGameId}/join`)
      .send({ name: '   ' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debe devolver 404 si la partida no existe', async () => {
    const res = await request(app)
      .post('/api/games/partida-inexistente-99/join')
      .send({ name: 'Carlos' });

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('debe devolver 409 al intentar unirse a una partida FINISHED', async () => {
    // Crear una partida y marcarla como finalizada directamente en Prisma
    const gameRes = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'FREE' });
    const finishedGameId = gameRes.body.gameId;
    createdGameIds.push(finishedGameId);

    // Simular partida terminada actualizando Redis
    const { updateGameStatus } = require('../../src/redis/gameState');
    await updateGameStatus(finishedGameId, 'FINISHED');

    const res = await request(app)
      .post(`/api/games/${finishedGameId}/join`)
      .send({ name: 'Maria' });

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── GET /api/games/:gameId/leaderboard ───────────────────────────────────────

describe('GET /api/games/:gameId/leaderboard', () => {
  let lbGameId;

  beforeAll(async () => {
    // Crear partida y unir dos jugadores
    const gameRes = await request(app)
      .post('/api/games')
      .send({ categoryId, mode: 'FREE' });
    lbGameId = gameRes.body.gameId;
    createdGameIds.push(lbGameId);

    await request(app)
      .post(`/api/games/${lbGameId}/join`)
      .send({ name: 'Player1' });
    await request(app)
      .post(`/api/games/${lbGameId}/join`)
      .send({ name: 'Player2' });
  });

  it('debe devolver 409 si la partida aún no ha terminado', async () => {
    const res = await request(app).get(`/api/games/${lbGameId}/leaderboard`);
    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('status');
  });

  it('debe devolver 200 con leaderboard ordenado cuando la partida está FINISHED', async () => {
    // Terminar la partida en DB y Redis
    const prismaClient = require('../../src/db/prismaClient');
    await prismaClient.game.update({
      where: { id: lbGameId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    });
    const { updateGameStatus } = require('../../src/redis/gameState');
    await updateGameStatus(lbGameId, 'FINISHED');

    const res = await request(app).get(`/api/games/${lbGameId}/leaderboard`);
    expect(res.statusCode).toBe(200);
    expect(res.body.gameId).toBe(lbGameId);
    expect(res.body.status).toBe('FINISHED');
    expect(Array.isArray(res.body.leaderboard)).toBe(true);
    expect(res.body.leaderboard.length).toBe(2);

    // El primer elemento debe tener rank 1 y los campos correctos
    const first = res.body.leaderboard[0];
    expect(first.rank).toBe(1);
    expect(first).toHaveProperty('playerId');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('score');
  });

  it('debe devolver 404 si la partida no existe', async () => {
    const res = await request(app).get('/api/games/no-existe-99/leaderboard');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
