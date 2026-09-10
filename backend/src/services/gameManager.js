'use strict';

const prisma = require('../db/prismaClient');
const { getGameMeta, updateGameStatus, getGrid, getPlayers, getTimer, setTimer, expireGame } = require('../redis/gameState');

class GameManager {
  constructor() {
    this.timers = new Map();
  }

  /**
   * Inicia la partida si estaba en WAITING.
   * Si es TIMED, arranca el temporizador en el servidor.
   */
  async startGame(gameId, io) {
    const meta = await getGameMeta(gameId);
    if (!meta || meta.status !== 'WAITING') return;

    // Cambiar estado
    await updateGameStatus(gameId, 'IN_PROGRESS');

    if (meta.mode === 'TIMED' && meta.duration > 0) {
      // Iniciar el temporizador centralizado
      const intervalId = setInterval(async () => {
        let currentTimer = await getTimer(gameId);
        
        if (currentTimer === null) {
          // Si no existe, usamos la duración original
          currentTimer = meta.duration;
        }

        currentTimer -= 1;
        
        if (currentTimer <= 0) {
          // Fin del tiempo
          await setTimer(gameId, 0);
          clearInterval(this.timers.get(gameId));
          this.timers.delete(gameId);
          await this.endGame(gameId, io, 'TIME_UP');
        } else {
          await setTimer(gameId, currentTimer);
          // Opcional: Emitir sync de tiempo (podría ser cada 5s para no saturar, pero 1s está bien aquí)
          io.to(gameId).emit('timer:sync', { timeLeft: currentTimer });
        }
      }, 1000);

      this.timers.set(gameId, intervalId);
    }
  }

  /**
   * Verifica si el tablero está completamente lleno y correcto.
   * Si es así, termina la partida.
   */
  async checkWinCondition(gameId, io) {
    const meta = await getGameMeta(gameId);
    if (!meta || meta.status === 'FINISHED') return;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        crossword: { include: { words: true } }
      }
    });

    if (!game) return;

    const grid = await getGrid(gameId);
    let isComplete = true;

    // Verificar cada letra de cada palabra
    for (const wordObj of game.crossword.words) {
      const { word, row: startRow, col: startCol, direction } = wordObj;
      for (let i = 0; i < word.length; i++) {
        const r = direction === 'DOWN' ? startRow + i : startRow;
        const c = direction === 'ACROSS' ? startCol + i : startCol;
        
        const cellValue = grid[`${r}:${c}`];
        if (cellValue !== word[i].toUpperCase()) {
          isComplete = false;
          break;
        }
      }
      if (!isComplete) break;
    }

    if (isComplete) {
      // Detener timer si existía
      if (this.timers.has(gameId)) {
        clearInterval(this.timers.get(gameId));
        this.timers.delete(gameId);
      }
      await this.endGame(gameId, io, 'COMPLETED');
    }
  }

  /**
   * Finaliza la partida, persiste resultados en Postgres y notifica.
   */
  async endGame(gameId, io, reason) {
    const meta = await getGameMeta(gameId);
    if (!meta || meta.status === 'FINISHED') return;

    // 1. Marcar como finalizado en Redis
    await updateGameStatus(gameId, 'FINISHED');

    // 2. Marcar como finalizado en PostgreSQL
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
      }
    });

    // 3. (Opcional) Guardar puntajes de jugadores desde Redis a PostgreSQL
    const players = await getPlayers(gameId);
    for (const p of players) {
      await prisma.player.update({
        where: { id: p.id },
        data: {
          score: p.score || 0,
        }
      });
    }

    // 4. Emitir evento final
    io.to(gameId).emit('game:ended', {
      gameId,
      reason, // 'COMPLETED' o 'TIME_UP'
      players
    });
  }
}

// Exportar como singleton
const gameManager = new GameManager();
module.exports = gameManager;
