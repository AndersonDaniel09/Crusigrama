'use strict';

const prisma = require('../../db/prismaClient');
const { verifyToken } = require('../../utils/token');
const { getGameMeta, getGrid, getPlayers, updateCell } = require('../../redis/gameState');

// Para llevar un registro en memoria de a qué partida pertenece cada socket.
// Útil en handleDisconnect. (En un entorno escalado, esto requeriría Redis Pub/Sub o el adaptador de Redis de Socket.io).
const socketDataMap = new Map();

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
  } catch (error) {
    console.error('[Socket] Error en handleCellUpdate:', error);
    socket.emit('error', { message: 'Error interno al actualizar la celda.' });
  }
}

/**
 * Maneja la desconexión de un socket.
 */
function handleDisconnect(socket, io) {
  const data = socketDataMap.get(socket.id);
  if (data) {
    const { gameId, playerId, name } = data;
    // Difundir a la room que el jugador se desconectó
    socket.to(gameId).emit('player:left', { playerId, name });
    socketDataMap.delete(socket.id);
  }
  console.log(`[Socket] Cliente desconectado: ${socket.id}`);
}

module.exports = {
  handleJoin,
  handleCellUpdate,
  handleDisconnect,
};
