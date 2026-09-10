const { Router } = require('express');

const router = Router();

/**
 * GET /health
 * Endpoint de salud para verificar que el servidor está en pie.
 * Útil para healthchecks de Docker / orquestadores.
 */
router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'crucigrama-backend',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

module.exports = router;
