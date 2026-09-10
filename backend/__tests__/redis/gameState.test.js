'use strict';

const {
  createGameState,
  getGameMeta,
  updateGameStatus,
  updateCell,
  getGrid,
  addPlayer,
  updatePlayerScore,
  getPlayers,
  setTimer,
  getTimer,
  deleteGameState,
  expireGame,
  _keys,
} = require('../../src/redis/gameState');

// Importamos el cliente para poder cerrarlo al final de los tests
const redis = require('../../src/redis/client');

// ID único para cada suite de tests (evita colisiones si los tests corren en paralelo)
const TEST_GAME_ID = `test-${Date.now()}`;

// Limpiar el estado antes y después de los tests
beforeEach(async () => {
  await deleteGameState(TEST_GAME_ID);
});

afterAll(async () => {
  await deleteGameState(TEST_GAME_ID);
  await redis.quit();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('gameState — createGameState & getGameMeta', () => {
  it('debe crear el estado inicial de una partida FREE', async () => {
    await createGameState(TEST_GAME_ID, {
      mode: 'FREE',
      crosswordId: 'crossword-uuid-1',
    });

    const meta = await getGameMeta(TEST_GAME_ID);
    expect(meta).not.toBeNull();
    expect(meta.status).toBe('WAITING');
    expect(meta.mode).toBe('FREE');
    expect(meta.crosswordId).toBe('crossword-uuid-1');
  });

  it('debe retornar null si la partida no existe', async () => {
    const meta = await getGameMeta('partida-inexistente-xyz');
    expect(meta).toBeNull();
  });

  it('debe inicializar el timer para partidas TIMED', async () => {
    await createGameState(TEST_GAME_ID, {
      mode: 'TIMED',
      crosswordId: 'crossword-uuid-2',
      duration: 120,
    });

    const timer = await getTimer(TEST_GAME_ID);
    expect(timer).toBe(120);
  });
});

describe('gameState — updateGameStatus', () => {
  it('debe cambiar el estado de WAITING a IN_PROGRESS', async () => {
    await createGameState(TEST_GAME_ID, { mode: 'FREE', crosswordId: 'c-1' });
    await updateGameStatus(TEST_GAME_ID, 'IN_PROGRESS');

    const meta = await getGameMeta(TEST_GAME_ID);
    expect(meta.status).toBe('IN_PROGRESS');
  });

  it('debe cambiar el estado a FINISHED', async () => {
    await createGameState(TEST_GAME_ID, { mode: 'FREE', crosswordId: 'c-1' });
    await updateGameStatus(TEST_GAME_ID, 'FINISHED');

    const meta = await getGameMeta(TEST_GAME_ID);
    expect(meta.status).toBe('FINISHED');
  });
});

describe('gameState — grid (celdas)', () => {
  beforeEach(async () => {
    await createGameState(TEST_GAME_ID, { mode: 'FREE', crosswordId: 'c-1' });
  });

  it('debe guardar una celda y recuperarla correctamente', async () => {
    await updateCell(TEST_GAME_ID, 0, 0, 'c');

    const grid = await getGrid(TEST_GAME_ID);
    expect(grid['0:0']).toBe('C'); // Debe guardarse en mayúscula
  });

  it('debe actualizar una celda ya existente', async () => {
    await updateCell(TEST_GAME_ID, 1, 2, 'A');
    await updateCell(TEST_GAME_ID, 1, 2, 'B');

    const grid = await getGrid(TEST_GAME_ID);
    expect(grid['1:2']).toBe('B');
  });

  it('debe devolver un objeto vacío si no hay celdas', async () => {
    const grid = await getGrid(TEST_GAME_ID);
    expect(grid).toEqual({});
  });
});

describe('gameState — players (jugadores)', () => {
  const PLAYER_ID = 'player-uuid-test-1';

  beforeEach(async () => {
    await createGameState(TEST_GAME_ID, { mode: 'FREE', crosswordId: 'c-1' });
  });

  it('debe añadir un jugador y leerlo correctamente', async () => {
    await addPlayer(TEST_GAME_ID, PLAYER_ID, { name: 'Ana' });

    const players = await getPlayers(TEST_GAME_ID);
    expect(players).toHaveLength(1);
    expect(players[0].name).toBe('Ana');
    expect(players[0].score).toBe(0);
    expect(players[0].timeSpent).toBe(0);
  });

  it('debe actualizar el puntaje de un jugador', async () => {
    await addPlayer(TEST_GAME_ID, PLAYER_ID, { name: 'Ana' });
    await updatePlayerScore(TEST_GAME_ID, PLAYER_ID, 5, 42);

    const players = await getPlayers(TEST_GAME_ID);
    const ana = players.find((p) => p.id === PLAYER_ID);
    expect(ana.score).toBe(5);
    expect(ana.timeSpent).toBe(42);
  });

  it('debe lanzar error al actualizar un jugador inexistente', async () => {
    await expect(
      updatePlayerScore(TEST_GAME_ID, 'no-existe', 1, 1),
    ).rejects.toThrow();
  });

  it('debe soportar múltiples jugadores en la misma partida', async () => {
    await addPlayer(TEST_GAME_ID, 'player-1', { name: 'Ana' });
    await addPlayer(TEST_GAME_ID, 'player-2', { name: 'Luis' });

    const players = await getPlayers(TEST_GAME_ID);
    expect(players).toHaveLength(2);
  });
});

describe('gameState — timer', () => {
  it('debe establecer y leer el timer correctamente', async () => {
    await setTimer(TEST_GAME_ID, 90);
    const timer = await getTimer(TEST_GAME_ID);
    expect(timer).toBe(90);
  });

  it('debe actualizar el timer al llamar a setTimer de nuevo', async () => {
    await setTimer(TEST_GAME_ID, 90);
    await setTimer(TEST_GAME_ID, 45);
    const timer = await getTimer(TEST_GAME_ID);
    expect(timer).toBe(45);
  });

  it('debe retornar null si el timer no existe', async () => {
    const timer = await getTimer('partida-sin-timer');
    expect(timer).toBeNull();
  });
});

describe('gameState — deleteGameState', () => {
  it('debe eliminar todas las claves de la partida', async () => {
    await createGameState(TEST_GAME_ID, {
      mode: 'TIMED',
      crosswordId: 'c-1',
      duration: 60,
    });
    await addPlayer(TEST_GAME_ID, 'p-1', { name: 'Test' });
    await updateCell(TEST_GAME_ID, 0, 0, 'A');

    await deleteGameState(TEST_GAME_ID);

    const meta = await getGameMeta(TEST_GAME_ID);
    const grid = await getGrid(TEST_GAME_ID);
    const players = await getPlayers(TEST_GAME_ID);
    const timer = await getTimer(TEST_GAME_ID);

    expect(meta).toBeNull();
    expect(grid).toEqual({});
    expect(players).toEqual([]);
    expect(timer).toBeNull();
  });
});
