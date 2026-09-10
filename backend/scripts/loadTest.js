#!/usr/bin/env node
/**
 * Script de prueba de carga — Etapa 10
 * =====================================
 * Simula múltiples partidas simultáneas con varios jugadores cada una.
 * Solo usa REST (no Socket.io) para mantener el script simple y sin deps extra.
 *
 * Uso:
 *   node scripts/loadTest.js [partidas] [jugadoresPorPartida]
 *
 * Ejemplos:
 *   node scripts/loadTest.js         # 10 partidas × 4 jugadores (por defecto)
 *   node scripts/loadTest.js 20 6    # 20 partidas × 6 jugadores
 */

'use strict';

const http = require('http');

const BASE_URL  = process.env.API_URL || 'http://localhost:3001';
const N_GAMES   = parseInt(process.argv[2], 10) || 10;
const N_PLAYERS = parseInt(process.argv[3], 10) || 4;

// ── Utilidad HTTP mínima ────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Lógica de carga ─────────────────────────────────────────────────────────
async function loadTest() {
  console.log(`\n🚀 Iniciando prueba de carga`);
  console.log(`   Partidas simultáneas : ${N_GAMES}`);
  console.log(`   Jugadores por partida: ${N_PLAYERS}`);
  console.log(`   API Base URL         : ${BASE_URL}\n`);

  const start = Date.now();

  // 1. Obtener la primera categoría disponible
  const catRes = await request('GET', '/api/categories');
  if (catRes.status !== 200 || !catRes.body.categories?.length) {
    console.error('❌ No se pudieron obtener categorías. ¿Está el backend corriendo?');
    process.exit(1);
  }
  const categoryId = catRes.body.categories[0].id;
  console.log(`✅ Categoría encontrada: "${catRes.body.categories[0].name}"\n`);

  // 2. Crear N partidas en paralelo
  console.log(`📋 Creando ${N_GAMES} partidas en paralelo…`);
  const gameResults = await Promise.allSettled(
    Array.from({ length: N_GAMES }, () =>
      request('POST', '/api/games', { categoryId, mode: 'FREE' })
    )
  );

  const games = gameResults
    .filter((r) => r.status === 'fulfilled' && r.value.status === 201)
    .map((r) => r.value.body.gameId);

  const failedGames = N_GAMES - games.length;
  console.log(`   ✅ Creadas: ${games.length}/${N_GAMES}${failedGames > 0 ? `  ❌ Fallidas: ${failedGames}` : ''}\n`);

  // 3. Unir N jugadores a cada partida en paralelo
  console.log(`👥 Uniendo ${N_PLAYERS} jugadores a cada partida…`);
  const joinResults = await Promise.allSettled(
    games.flatMap((gameId) =>
      Array.from({ length: N_PLAYERS }, (_, i) =>
        request('POST', `/api/games/${gameId}/join`, { name: `Player_${i + 1}_${gameId.slice(0, 4)}` })
      )
    )
  );

  const joined  = joinResults.filter((r) => r.status === 'fulfilled' && r.value.status === 201).length;
  const failedJ = joinResults.length - joined;
  console.log(`   ✅ Unidos: ${joined}/${games.length * N_PLAYERS}${failedJ > 0 ? `  ❌ Fallidos: ${failedJ}` : ''}\n`);

  // 4. Resumen
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const totalOps = games.length + joined;
  const opsPerSec = (totalOps / (Date.now() - start) * 1000).toFixed(1);

  console.log('═══════════════════════════════════════');
  console.log('📊 RESULTADOS');
  console.log('═══════════════════════════════════════');
  console.log(`   Tiempo total      : ${elapsed}s`);
  console.log(`   Operaciones REST  : ${totalOps} (${opsPerSec} ops/s)`);
  console.log(`   Partidas creadas  : ${games.length}/${N_GAMES}`);
  console.log(`   Jugadores unidos  : ${joined}/${games.length * N_PLAYERS}`);
  console.log(`   Tasa de éxito     : ${((joined / (games.length * N_PLAYERS)) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════\n');

  if (failedGames > 0 || failedJ > 0) {
    console.warn('⚠️  Hay fallos. Revisa los logs del backend para más detalles.');
    process.exit(1);
  }

  console.log('🎉 Prueba de carga completada con éxito.\n');
}

loadTest().catch((err) => {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
});
