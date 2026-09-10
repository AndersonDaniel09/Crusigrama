const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRouter = require('./routes/health');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rutas ─────────────────────────────────────────────────────
app.use('/health', healthRouter);

// Placeholder para las rutas que se agregarán en etapas posteriores
// app.use('/api/categories', categoriesRouter);  ← Etapa 3
// app.use('/api/games', gamesRouter);             ← Etapa 3
// app.use('/api/players', playersRouter);         ← Etapa 4

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error handler global ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
});

module.exports = app;
