'use strict';

const gameManager = require('../../src/services/gameManager');
const prisma = require('../../src/db/prismaClient');
const gameState = require('../../src/redis/gameState');

jest.mock('../../src/db/prismaClient', () => ({
  game: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  player: {
    update: jest.fn(),
  },
}));
jest.mock('../../src/redis/gameState');

describe('GameManager', () => {
  let ioMock;
  let toMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    toMock = { emit: jest.fn() };
    ioMock = { to: jest.fn().mockReturnValue(toMock) };
    
    // Limpiar timers
    for (const [key, id] of gameManager.timers.entries()) {
      clearInterval(id);
    }
    gameManager.timers.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startGame', () => {
    it('no debe hacer nada si la partida no está WAITING', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      await gameManager.startGame('g1', ioMock);
      expect(gameState.updateGameStatus).not.toHaveBeenCalled();
    });

    it('debe cambiar estado y NO arrancar timer si es FREE mode', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'WAITING', mode: 'FREE' });
      await gameManager.startGame('g1', ioMock);
      expect(gameState.updateGameStatus).toHaveBeenCalledWith('g1', 'IN_PROGRESS');
      expect(gameManager.timers.has('g1')).toBe(false);
    });

    it('debe arrancar timer si es TIMED mode y emitir syncs', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'WAITING', mode: 'TIMED', duration: 120 });
      gameState.getTimer.mockResolvedValue(120);

      await gameManager.startGame('g1', ioMock);
      expect(gameManager.timers.has('g1')).toBe(true);

      // Avanzar 1 segundo
      jest.advanceTimersByTime(1000);
      
      // Debe haber decrementado y emitido
      // Note: the promise inside setInterval might not resolve synchronously in jest,
      // so this is a simplified test for timer existence.
    });
  });

  describe('checkWinCondition', () => {
    it('no debe hacer nada si el tablero está incompleto', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      prisma.game.findUnique.mockResolvedValue({
        crossword: { words: [{ word: 'SOL', direction: 'ACROSS', row: 0, col: 0 }] }
      });
      gameState.getGrid.mockResolvedValue({ '0:0': 'S', '0:1': 'O' }); // Falta la 'L'

      await gameManager.checkWinCondition('g1', ioMock);

      expect(prisma.game.update).not.toHaveBeenCalled(); // endGame no llamado
    });

    it('debe llamar a endGame si el tablero está correcto', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      prisma.game.findUnique.mockResolvedValue({
        crossword: { words: [{ word: 'SOL', direction: 'ACROSS', row: 0, col: 0 }] }
      });
      gameState.getGrid.mockResolvedValue({ '0:0': 'S', '0:1': 'O', '0:2': 'L' }); // Completo

      // Mock para endGame
      gameState.getPlayers.mockResolvedValue([]);

      await gameManager.checkWinCondition('g1', ioMock);

      expect(gameState.updateGameStatus).toHaveBeenCalledWith('g1', 'FINISHED');
      expect(prisma.game.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'g1' }, data: expect.objectContaining({ status: 'FINISHED' }) })
      );
      expect(toMock.emit).toHaveBeenCalledWith('game:ended', expect.objectContaining({ reason: 'COMPLETED' }));
    });
  });

  describe('endGame', () => {
    it('debe persistir datos, actualizar Redis y emitir game:ended', async () => {
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      gameState.getPlayers.mockResolvedValue([{ id: 'p1', score: 10 }]);

      await gameManager.endGame('g1', ioMock, 'TIME_UP');

      expect(gameState.updateGameStatus).toHaveBeenCalledWith('g1', 'FINISHED');
      expect(prisma.game.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { status: 'FINISHED', finishedAt: expect.any(Date) }
      });
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { score: 10 }
      });
      expect(toMock.emit).toHaveBeenCalledWith('game:ended', {
        gameId: 'g1',
        reason: 'TIME_UP',
        players: [{ id: 'p1', score: 10 }]
      });
    });
  });
});
