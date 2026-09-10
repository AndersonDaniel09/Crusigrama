'use strict';

const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Instancia única de ioredis reutilizable en todo el backend.
 * Se conecta usando las variables de entorno del .env.
 */
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // Reintentar conexión de forma exponencial hasta 10 intentos
  retryStrategy: (times) => {
    if (times > 10) return null; // Dejar de reintentar
    return Math.min(times * 100, 3000); // ms de espera entre reintentos
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[Redis] Conectado correctamente.');
});

redis.on('error', (err) => {
  console.error('[Redis] Error de conexión:', err.message);
});

module.exports = redis;
