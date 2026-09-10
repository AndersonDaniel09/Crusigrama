require('dotenv').config();

const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;

// ── HTTP server ──────────────────────────────────────────────
const httpServer = createServer(app);

// ── Socket.io (se configurará en profundidad en Etapa 5) ─────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Adjuntar io a app para acceso desde los routers si es necesario
app.set('io', io);

const { initSocket } = require('./socket');

// Inicializar todos los handlers de eventos de Socket.io
initSocket(io);

// ── Start ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { httpServer, io };
