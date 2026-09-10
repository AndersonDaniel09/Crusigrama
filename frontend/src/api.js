import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Obtiene todas las categorías disponibles */
export const getCategories = () =>
  api.get('/categories').then((r) => r.data.categories);

/**
 * Crea una nueva partida.
 * @param {{ categoryId: string, mode: 'FREE'|'TIMED', duration?: number }} data
 */
export const createGame = (data) =>
  api.post('/games', data).then((r) => r.data);

/** Obtiene metadata de una partida (sin token requerido) */
export const getGame = (gameId) =>
  api.get(`/games/${gameId}`).then((r) => r.data);

/**
 * Un invitado se une a la partida con su nombre.
 * @param {string} gameId
 * @param {string} name
 * @returns {{ playerId, name, gameId, token, crossword }}
 */
export const joinGame = (gameId, name) =>
  api.post(`/games/${gameId}/join`, { name }).then((r) => r.data);

/** Obtiene el leaderboard final de una partida terminada */
export const getLeaderboard = (gameId) =>
  api.get(`/games/${gameId}/leaderboard`).then((r) => r.data);

export default api;
