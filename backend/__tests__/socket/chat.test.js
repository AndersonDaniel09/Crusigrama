'use strict';

const {
  handleChat,
  _CHAT_MAX_LENGTH,
  _CHAT_MAX_MSGS,
  _CHAT_WINDOW_MS,
  _chatRateMap,
} = require('../../src/socket/handlers/gameHandler');
const { verifyToken } = require('../../src/utils/token');

jest.mock('../../src/utils/token');
// Silenciar otros módulos que gameHandler importa
jest.mock('../../src/db/prismaClient', () => ({ game: { findUnique: jest.fn() } }));
jest.mock('../../src/redis/gameState');
jest.mock('../../src/services/gameManager', () => ({
  startGame: jest.fn().mockResolvedValue(),
  checkWinCondition: jest.fn().mockResolvedValue(),
}));

describe('handleChat', () => {
  let socketMock;
  let ioMock;
  let toMock;

  beforeEach(() => {
    jest.clearAllMocks();
    _chatRateMap.clear(); // limpiar rate-limit entre tests

    toMock   = { emit: jest.fn() };
    socketMock = { id: 'socket-1', emit: jest.fn(), to: jest.fn().mockReturnValue(toMock) };
    ioMock   = { to: jest.fn().mockReturnValue(toMock) };
  });

  it('debe emitir error si faltan campos', () => {
    handleChat(socketMock, ioMock, {});
    expect(socketMock.emit).toHaveBeenCalledWith('error', expect.any(Object));
  });

  it('debe emitir error si el token es inválido', () => {
    verifyToken.mockImplementation(() => { throw new Error(); });
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'bad', text: 'Hola' });
    expect(socketMock.emit).toHaveBeenCalledWith('error', { message: 'Token inválido.' });
  });

  it('debe emitir error si el token no pertenece a la partida', () => {
    verifyToken.mockReturnValue({ gameId: 'otro-game', playerId: 'p1', name: 'Ana' });
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: 'Hola' });
    expect(socketMock.emit).toHaveBeenCalledWith('error', { message: 'Token no pertenece a esta partida.' });
  });

  it('debe emitir error si el texto está vacío', () => {
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: '   ' });
    expect(socketMock.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('vacío') }));
  });

  it(`debe emitir error si el texto supera ${_CHAT_MAX_LENGTH} caracteres`, () => {
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
    const longText = 'A'.repeat(_CHAT_MAX_LENGTH + 1);
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: longText });
    expect(socketMock.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('caracteres') }));
  });

  it('debe difundir chat:message con los campos correctos si todo es válido', () => {
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: '  Hola mundo  ' });

    expect(ioMock.to).toHaveBeenCalledWith('g1');
    expect(toMock.emit).toHaveBeenCalledWith('chat:message', {
      playerId: 'p1',
      name: 'Ana',
      text: 'Hola mundo', // el texto debe estar trimeado
      timestamp: expect.any(String),
    });
  });

  it(`debe bloquear al jugador si supera ${_CHAT_MAX_MSGS} mensajes en la ventana de tiempo`, () => {
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });

    // Enviar el máximo permitido de mensajes — todos deben pasar
    for (let i = 0; i < _CHAT_MAX_MSGS; i++) {
      handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: `Mensaje ${i}` });
    }
    expect(toMock.emit).toHaveBeenCalledTimes(_CHAT_MAX_MSGS);

    // El siguiente debe ser rechazado por rate limit
    handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: 'Spam' });
    expect(socketMock.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('Demasiados') }));
  });

  it('el rate limit no debe afectar a jugadores distintos', () => {
    // Agotar el rate limit de p1
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p1', name: 'Ana' });
    for (let i = 0; i < _CHAT_MAX_MSGS; i++) {
      handleChat(socketMock, ioMock, { gameId: 'g1', token: 'valid', text: `Msg ${i}` });
    }

    // p2 debe poder enviar sin problema
    verifyToken.mockReturnValue({ gameId: 'g1', playerId: 'p2', name: 'Luis' });
    const socketMock2 = { id: 'socket-2', emit: jest.fn(), to: jest.fn().mockReturnValue(toMock) };
    handleChat(socketMock2, ioMock, { gameId: 'g1', token: 'valid2', text: 'Hola desde p2' });

    expect(socketMock2.emit).not.toHaveBeenCalledWith('error', expect.anything());
  });
});
