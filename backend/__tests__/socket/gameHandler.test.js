'use strict';

const { handleJoin, handleCellUpdate, handleDisconnect } = require('../../src/socket/handlers/gameHandler');
const { verifyToken } = require('../../src/utils/token');
const prisma = require('../../src/db/prismaClient');
const gameState = require('../../src/redis/gameState');

jest.mock('../../src/utils/token');
jest.mock('../../src/db/prismaClient', () => ({
  game: {
    findUnique: jest.fn(),
  },
}));
jest.mock('../../src/redis/gameState');
// Mock del gameManager para que checkWinCondition no falle
jest.mock('../../src/services/gameManager', () => ({
  startGame: jest.fn().mockResolvedValue(),
  checkWinCondition: jest.fn().mockResolvedValue(),
}));

describe('Socket.io gameHandler', () => {
  let socketMock;
  let ioMock;
  let toMock;

  beforeEach(() => {
    jest.clearAllMocks();

    toMock = {
      emit: jest.fn(),
    };

    socketMock = {
      id: 'socket-123',
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue(toMock),
    };

    ioMock = {
      to: jest.fn().mockReturnValue(toMock),
    };
  });

  describe('handleJoin', () => {
    it('debe emitir error si faltan credenciales', async () => {
      await handleJoin(socketMock, ioMock, {});
      expect(socketMock.emit).toHaveBeenCalledWith('error', expect.any(Object));
    });

    it('debe emitir error si el token es inválido', async () => {
      verifyToken.mockImplementation(() => { throw new Error(); });
      await handleJoin(socketMock, ioMock, { gameId: 'g1', token: 'bad' });
      expect(socketMock.emit).toHaveBeenCalledWith('error', { message: 'Token inválido.' });
    });

    it('debe unirse y emitir estado si todo es correcto', async () => {
      verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      gameState.getGrid.mockResolvedValue({ '0:0': 'A' });
      gameState.getPlayers.mockResolvedValue([{ name: 'Ana' }]);

      await handleJoin(socketMock, ioMock, { gameId: 'g1', token: 'valid' });

      expect(socketMock.join).toHaveBeenCalledWith('g1');
      expect(socketMock.to).toHaveBeenCalledWith('g1');
      expect(toMock.emit).toHaveBeenCalledWith('player:joined', { playerId: 'p1', name: 'Ana' });
      expect(socketMock.emit).toHaveBeenCalledWith('game:state', {
        status: 'IN_PROGRESS',
        grid: { '0:0': 'A' },
        players: [{ name: 'Ana' }],
      });
    });
  });

  describe('handleCellUpdate', () => {
    it('debe validar la celda y emitir cell:updated con correct:true', async () => {
      verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1' });
      
      // Simular base de datos con una palabra horizontal "HOLA" en (0,0)
      prisma.game.findUnique.mockResolvedValue({
        crossword: {
          words: [
            { word: 'HOLA', direction: 'ACROSS', row: 0, col: 0 }
          ]
        }
      });

      // El usuario envía 'O' en row:0 col:1 (que es correcto)
      await handleCellUpdate(socketMock, ioMock, {
        gameId: 'g1',
        token: 'valid',
        row: 0,
        col: 1,
        letter: 'o' // se debe pasar a mayúscula internamente
      });

      expect(gameState.updateCell).toHaveBeenCalledWith('g1', 0, 1, 'O');
      expect(ioMock.to).toHaveBeenCalledWith('g1');
      expect(toMock.emit).toHaveBeenCalledWith('cell:updated', {
        row: 0,
        col: 1,
        letter: 'O',
        playerId: 'p1',
        correct: true,
      });
    });

    it('debe emitir stats:update tras un acierto correcto', async () => {
      verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1' });
      prisma.game.findUnique.mockResolvedValue({
        crossword: {
          words: [{ word: 'HOLA', direction: 'ACROSS', row: 0, col: 0 }]
        }
      });
      gameState.incrementPlayerScore.mockResolvedValue(1);
      gameState.getPlayers.mockResolvedValue([
        { id: 'p1', name: 'Ana', score: 1 },
      ]);

      await handleCellUpdate(socketMock, ioMock, {
        gameId: 'g1', token: 'valid', row: 0, col: 1, letter: 'O'
      });

      expect(gameState.incrementPlayerScore).toHaveBeenCalledWith('g1', 'p1');
      expect(ioMock.to).toHaveBeenCalledWith('g1');
      // stats:update debe haber sido emitido con el ranking
      const emitCalls = toMock.emit.mock.calls;
      const statsCall = emitCalls.find(([event]) => event === 'stats:update');
      expect(statsCall).toBeDefined();
      expect(statsCall[1][0]).toMatchObject({ rank: 1, playerId: 'p1', name: 'Ana', score: 1 });
    });

    it('debe validar la celda y emitir cell:updated con correct:false si es errónea', async () => {
      verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1' });
      prisma.game.findUnique.mockResolvedValue({
        crossword: {
          words: [{ word: 'HOLA', direction: 'ACROSS', row: 0, col: 0 }]
        }
      });

      // Envía 'X' en 0,1 (incorrecto)
      await handleCellUpdate(socketMock, ioMock, {
        gameId: 'g1', token: 'valid', row: 0, col: 1, letter: 'X'
      });

      expect(toMock.emit).toHaveBeenCalledWith('cell:updated', expect.objectContaining({
        letter: 'X',
        correct: false,
      }));
    });
  });

  describe('handleDisconnect', () => {
    it('debe emitir player:left si el socket estaba registrado', async () => {
      // Registrar socket primero
      verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
      gameState.getGameMeta.mockResolvedValue({ status: 'IN_PROGRESS' });
      await handleJoin(socketMock, ioMock, { gameId: 'g1', token: 'valid' });

      // Desconectar
      handleDisconnect(socketMock, ioMock);
      expect(socketMock.to).toHaveBeenCalledWith('g1');
      expect(toMock.emit).toHaveBeenCalledWith('player:left', { playerId: 'p1', name: 'Ana' });
    });
  });
});
