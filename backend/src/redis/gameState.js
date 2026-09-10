'use strict';

const redis = require('./client');

// ─── TTLs (en segundos) ─────────────────────────────────────────────────────
const TTL_WAITING = 60 * 60 * 24;   // 24 h — partida esperando jugadores
const TTL_FINISHED = 60 * 60;       // 1 h  — partida terminada o abandonada

// ─── Helpers de clave ────────────────────────────────────────────────────────
const keys = {
  meta: (gameId) => `game:${gameId}:meta`,
  grid: (gameId) => `game:${gameId}:grid`,
  players: (gameId) => `game:${gameId}:players`,
  timer: (gameId) => `game:${gameId}:timer`,
};

/**
 * Crea el estado inicial de una partida en Redis.
 * @param {string} gameId  - UUID de la partida (generado por Prisma).
 * @param {object} meta    - { mode: 'TIMED'|'FREE', crosswordId, duration? }
 */
async function createGameState(gameId, meta) {
  const pipeline = redis.pipeline();

  // Hash de metadatos
  pipeline.hset(keys.meta(gameId), {
    status: 'WAITING',
    mode: meta.mode,
    crosswordId: meta.crosswordId,
    duration: meta.duration ?? 0,
  });

  // Si es contrarreloj, inicializar el timer con el valor completo
  if (meta.mode === 'TIMED' && meta.duration) {
    pipeline.set(keys.timer(gameId), meta.duration);
  }

  // Establecer TTL en la clave meta (punto de ancla para el ciclo de vida)
  pipeline.expire(keys.meta(gameId), TTL_WAITING);

  await pipeline.exec();
}

/**
 * Devuelve los metadatos de la partida.
 * @returns {object|null} - { status, mode, crosswordId, duration } o null si no existe.
 */
async function getGameMeta(gameId) {
  const data = await redis.hgetall(keys.meta(gameId));
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

/**
 * Actualiza el campo `status` de la partida y ajusta el TTL si terminó.
 * @param {string} gameId
 * @param {'WAITING'|'IN_PROGRESS'|'FINISHED'} status
 */
async function updateGameStatus(gameId, status) {
  await redis.hset(keys.meta(gameId), 'status', status);
  if (status === 'FINISHED') {
    await expireGame(gameId, TTL_FINISHED);
  }
}

/**
 * Escribe la letra de un jugador en una celda del grid.
 * @param {string} gameId
 * @param {number} row
 * @param {number} col
 * @param {string} letter  - Letra en mayúscula.
 */
async function updateCell(gameId, row, col, letter) {
  await redis.hset(keys.grid(gameId), `${row}:${col}`, letter.toUpperCase());
}

/**
 * Devuelve todas las celdas completadas del grid.
 * @returns {object} - Mapa de `"row:col"` → letra.
 */
async function getGrid(gameId) {
  const raw = await redis.hgetall(keys.grid(gameId));
  return raw || {};
}

/**
 * Registra un nuevo jugador en la partida.
 * @param {string} gameId
 * @param {string} playerId   - UUID del jugador.
 * @param {object} playerData - { name }
 */
async function addPlayer(gameId, playerId, playerData) {
  const payload = JSON.stringify({
    name: playerData.name,
    score: 0,
    timeSpent: 0,
  });
  await redis.hset(keys.players(gameId), playerId, payload);
}

/**
 * Actualiza la puntuación y tiempo de un jugador.
 * @param {string} gameId
 * @param {string} playerId
 * @param {number} score
 * @param {number} timeSpent  - Segundos.
 */
async function updatePlayerScore(gameId, playerId, score, timeSpent) {
  const raw = await redis.hget(keys.players(gameId), playerId);
  if (!raw) throw new Error(`Jugador ${playerId} no encontrado en partida ${gameId}`);
  const player = JSON.parse(raw);
  player.score = score;
  player.timeSpent = timeSpent;
  await redis.hset(keys.players(gameId), playerId, JSON.stringify(player));
}

/**
 * Devuelve todos los jugadores de la partida con su estado actual.
 * @returns {Array<{id, name, score, timeSpent}>}
 */
async function getPlayers(gameId) {
  const raw = await redis.hgetall(keys.players(gameId));
  if (!raw) return [];
  return Object.entries(raw).map(([id, json]) => ({ id, ...JSON.parse(json) }));
}

/**
 * Establece o actualiza el timer en segundos.
 */
async function setTimer(gameId, seconds) {
  await redis.set(keys.timer(gameId), seconds);
}

/**
 * Obtiene los segundos restantes del timer.
 * @returns {number|null}
 */
async function getTimer(gameId) {
  const val = await redis.get(keys.timer(gameId));
  return val !== null ? parseInt(val, 10) : null;
}

/**
 * Elimina TODAS las claves asociadas a una partida de Redis.
 */
async function deleteGameState(gameId) {
  await redis.del(
    keys.meta(gameId),
    keys.grid(gameId),
    keys.players(gameId),
    keys.timer(gameId),
  );
}

/**
 * Pone un TTL en segundos a todas las claves de la partida.
 * Útil para limpiar partidas terminadas o abandonadas automáticamente.
 */
async function expireGame(gameId, seconds) {
  const pipeline = redis.pipeline();
  pipeline.expire(keys.meta(gameId), seconds);
  pipeline.expire(keys.grid(gameId), seconds);
  pipeline.expire(keys.players(gameId), seconds);
  pipeline.expire(keys.timer(gameId), seconds);
  await pipeline.exec();
}

module.exports = {
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
  // Exponer las claves para uso interno (ej: Socket.io)
  _keys: keys,
};
