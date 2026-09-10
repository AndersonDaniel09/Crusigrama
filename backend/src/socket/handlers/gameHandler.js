'use strict';

const prisma = require('../../db/prismaClient');
const { verifyToken } = require('../../utils/token');
const { getGameMeta, getGrid, getPlayers, updateCell, incrementPlayerScore } = require('../../redis/gameState');
const gameManager = require('../../services/gameManager');

// Para llevar un registro en memoria de a qué partida pertenece cada socket.
// Útil en handleDisconnect. (En un entorno escalado, esto requeriría Redis Pub/Sub o el adaptador de Redis de Socket.io).
const socketDataMap = new Map();

// ─── Rate Limiting simple para el chat ───────────────────────────────────────
// Mapa: playerId → array de timestamps (ms) de los últimos mensajes.
const chatRateMap = new Map();

const CHAT_MAX_LENGTH   = 200;       // caracteres máximos por mensaje
const CHAT_MAX_MSGS     = 5;         // máx mensajes permitidos...
const CHAT_WINDOW_MS    = 5_000;     // ...dentro de esta ventana de tiempo (ms)

/**
 * Calcula el ranking en vivo y lo difunde a toda la room.
 * @param {string} gameId
 * @param {import('socket.io').Server} io
 */
async function broadcastStats(gameId, io) {
  const players = await getPlayers(gameId);
  const ranked = [...players]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p, idx) => ({ rank: idx + 1, playerId: p.id, name: p.name, score: p.score || 0 }));
  io.to(gameId).emit('stats:update', ranked);
}

/**
 * Maneja cuando un cliente intenta unirse a la room de una partida.
 */
async function handleJoin(socket, io, payload) {
  try {
    const { gameId, token } = payload;
    if (!gameId || !token) {
      return socket.emit('error', { message: 'Faltan credenciales (gameId o token).' });
    }

    // 1. Validar el token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return socket.emit('error', { message: 'Token inválido.' });
    }

    // Comprobar que el token pertenece a esta partida
    if (decoded.gameId !== gameId) {
      return socket.emit('error', { message: 'El token no pertenece a esta partida.' });
    }

    // 2. Comprobar estado de la partida en Redis
    const meta = await getGameMeta(gameId);
    if (!meta) {
      return socket.emit('error', { message: 'Partida no encontrada o expirada.' });
    }

    // 3. Unir a la room
    socket.join(gameId);
    socketDataMap.set(socket.id, { gameId, playerId: decoded.playerId, name: decoded.name });

    // 4. Notificar a los DEMÁS en la room
    socket.to(gameId).emit('player:joined', {
      playerId: decoded.playerId,
      name: decoded.name,
    });

    // 5. Enviar el estado COMPLETO al recién llegado
    const grid = await getGrid(gameId);
    const players = await getPlayers(gameId);
    socket.emit('game:state', {
      status: meta.status,
      grid,
      players,
    });

    // 6. Iniciar la partida (y el timer si corresponde)
    if (meta.status === 'WAITING') {
      await gameManager.startGame(gameId, io);
    }
  } catch (error) {
    console.error('[Socket] Error en handleJoin:', error);
    socket.emit('error', { message: 'Error interno al unirse a la partida.' });
  }
}

/**
 * Maneja cuando un jugador actualiza una celda.
 */
async function handleCellUpdate(socket, io, payload) {
  try {
    const { gameId, token, row, col, letter } = payload;
    if (!gameId || !token || row === undefined || col === undefined || !letter) {
      return socket.emit('error', { message: 'Datos incompletos para actualizar celda.' });
    }

    // 1. Autenticar
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return socket.emit('error', { message: 'Token inválido.' });
    }

    if (decoded.gameId !== gameId) {
      return socket.emit('error', { message: 'Token inválido para esta partida.' });
    }

    // 2. Verificar en Prisma si la letra es correcta
    // Como las celdas pertenecen a CrosswordWords que tienen una palabra (word), 
    // necesitamos ver si alguna palabra que pase por esa celda tiene esa letra ahí.
    
    // Obtener la partida y su crucigrama para validar.
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        crossword: {
          include: { words: true },
        },
      },
    });

    if (!game) {
      return socket.emit('error', { message: 'Partida no encontrada.' });
    }

    const upperLetter = letter.toUpperCase();
    let isCorrect = false;

    // Buscar si alguna palabra del crucigrama cruza por (row, col)
    for (const wordObj of game.crossword.words) {
      const { word, row: startRow, col: startCol, direction } = wordObj;
      const length = word.length;

      // Calcular si (row, col) está dentro de la palabra actual
      if (direction === 'ACROSS') {
        if (row === startRow && col >= startCol && col < startCol + length) {
          const index = col - startCol;
          if (word[index].toUpperCase() === upperLetter) {
            isCorrect = true;
            break;
          }
        }
      } else if (direction === 'DOWN') {
        if (col === startCol && row >= startRow && row < startRow + length) {
          const index = row - startRow;
          if (word[index].toUpperCase() === upperLetter) {
            isCorrect = true;
            break;
          }
        }
      }
    }

    // 3. Escribir en Redis (solo si es correcta, o incluso si no lo es, 
    // pero generalmente solo se guarda en estado global si es correcta)
    // El prompt no especifica, pero lo normal es guardar todo lo que escribe el usuario.
    // Vamos a guardar en Redis para que todos vean la letra.
    await updateCell(gameId, row, col, upperLetter);

    // 4. Difundir a TODOS en la room (incluyendo al que envió)
    io.to(gameId).emit('cell:updated', {
      row,
      col,
      letter: upperLetter,
      playerId: decoded.playerId,
      correct: isCorrect,
    });

    // 5. Verificar condición de victoria si la letra es correcta
    if (isCorrect) {
      // Incrementar score del jugador en Redis
      await incrementPlayerScore(gameId, decoded.playerId);
      // Emitir estadísticas en vivo a toda la room
      await broadcastStats(gameId, io);
      // Comprobar si la partida ya terminó
      await gameManager.checkWinCondition(gameId, io);
    }
  } catch (error) {
    console.error('[Socket] Error en handleCellUpdate:', error);
    socket.emit('error', { message: 'Error interno al actualizar la celda.' });
  }
}

/**
 * Maneja la desconexión de un socket.
 * Limpia el mapa de sockets Y las entradas de rate-limit del chat
 * para evitar fugas de memoria en partidas de larga duración.
 */
function handleDisconnect(socket, io) {
  const data = socketDataMap.get(socket.id);
  if (data) {
    const { gameId, playerId, name } = data;
    // Difundir a la room que el jugador se desconectó
    socket.to(gameId).emit('player:left', { playerId, name });
    socketDataMap.delete(socket.id);
    // ✅ Limpiar rate-limit del chat para evitar fuga de memoria
    chatRateMap.delete(`${gameId}:${playerId}`);
  }
  console.log(`[Socket] Cliente desconectado: ${socket.id}`);
}

/**
 * Maneja un mensaje de chat enviado por un jugador.
 * Evento: chat:message   Payload: { gameId, token, text }
 * Difunde: chat:message  Payload: { name, text, timestamp }
 *
 * Reglas:
 *  - El token debe ser válido y pertenecer a la partida.
 *  - El texto no puede estar vacío ni superar CHAT_MAX_LENGTH caracteres.
 *  - Rate limit: CHAT_MAX_MSGS mensajes por CHAT_WINDOW_MS ms por jugador.
 *  - El chat es efímero (no se persiste en DB).
 */
function handleChat(socket, io, payload) {
  try {
    const { gameId, token, text } = payload || {};

    if (!gameId || !token || !text) {
      return socket.emit('error', { message: 'Datos incompletos para el chat.' });
    }

    // 1. Autenticar token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return socket.emit('error', { message: 'Token inválido.' });
    }

    if (decoded.gameId !== gameId) {
      return socket.emit('error', { message: 'Token no pertenece a esta partida.' });
    }

    // 2. Validar longitud del texto
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.length === 0) {
      return socket.emit('error', { message: 'El mensaje no puede estar vacío.' });
    }
    if (trimmed.length > CHAT_MAX_LENGTH) {
      return socket.emit('error', {
        message: `El mensaje no puede superar ${CHAT_MAX_LENGTH} caracteres.`,
      });
    }

    // 3. Rate limiting
    const now = Date.now();
    const key = `${gameId}:${decoded.playerId}`;
    const timestamps = (chatRateMap.get(key) || []).filter((t) => now - t < CHAT_WINDOW_MS);

    if (timestamps.length >= CHAT_MAX_MSGS) {
      return socket.emit('error', {
        message: `Demasiados mensajes. Espera unos segundos antes de continuar.`,
      });
    }

    timestamps.push(now);
    chatRateMap.set(key, timestamps);

    // 4. Difundir a TODA la room (incluyendo al emisor)
    io.to(gameId).emit('chat:message', {
      playerId: decoded.playerId,
      name: decoded.name,
      text: trimmed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Socket] Error en handleChat:', error);
    socket.emit('error', { message: 'Error interno en el chat.' });
  }
}

module.exports = {
  handleJoin,
  handleCellUpdate,
  handleDisconnect,
  handleChat,
  // Exponer constantes para los tests
  _CHAT_MAX_LENGTH: CHAT_MAX_LENGTH,
  _CHAT_MAX_MSGS: CHAT_MAX_MSGS,
  _CHAT_WINDOW_MS: CHAT_WINDOW_MS,
  _chatRateMap: chatRateMap,
};
