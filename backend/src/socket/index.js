'use strict';

const gameHandler = require('./handlers/gameHandler');

/**
 * Inicializa Socket.io y registra los eventos principales.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Registrar handlers de partida
    socket.on('game:join',     (payload) => gameHandler.handleJoin(socket, io, payload));
    socket.on('cell:update',   (payload) => gameHandler.handleCellUpdate(socket, io, payload));
    socket.on('chat:message',  (payload) => gameHandler.handleChat(socket, io, payload));
    socket.on('disconnect',    ()        => gameHandler.handleDisconnect(socket, io));
  });
}

module.exports = { initSocket };
