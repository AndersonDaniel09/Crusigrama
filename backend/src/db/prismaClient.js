'use strict';

const { PrismaClient } = require('@prisma/client');

/**
 * Instancia singleton de PrismaClient reutilizable en todo el backend.
 * Evita crear múltiples conexiones al pool de PostgreSQL.
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
