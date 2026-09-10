'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db/prismaClient');
const { createGameState, getGameMeta, addPlayer, getPlayers } = require('../redis/gameState');
const { generateToken } = require('../utils/token');

const router = Router();

// ─── Helpers de validación ───────────────────────────────────────────────────

const VALID_MODES = ['FREE', 'TIMED'];

function validateCreateGame(body) {
  const errors = [];
  const { categoryId, mode, duration } = body;

  if (!categoryId || typeof categoryId !== 'string') {
    errors.push('categoryId es requerido y debe ser un string.');
  }
  if (!mode || !VALID_MODES.includes(mode)) {
    errors.push(`mode es requerido y debe ser uno de: ${VALID_MODES.join(', ')}.`);
  }
  if (mode === 'TIMED') {
    const dur = parseInt(duration, 10);
    if (!duration || isNaN(dur) || dur <= 0) {
      errors.push('duration es requerido para el modo TIMED y debe ser un entero positivo (segundos).');
    }
  }

  return errors;
}

// ─── POST /api/games ─────────────────────────────────────────────────────────
/**
 * Crea una nueva partida.
 * Body: { categoryId, mode: 'FREE'|'TIMED', duration?: number }
 * Respuesta: { gameId, shareUrl, crossword, mode, duration }
 */
router.post('/', async (req, res, next) => {
  try {
    // 1. Validar inputs
    const errors = validateCreateGame(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const { categoryId, mode, duration } = req.body;

    // 2. Verificar que la categoría exista
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { crosswords: { select: { id: true, name: true } } },
    });

    if (!category) {
      return res.status(404).json({ error: `Categoría con id "${categoryId}" no encontrada.` });
    }

    // 3. Verificar que la categoría tenga al menos un crucigrama
    if (category.crosswords.length === 0) {
      return res.status(409).json({ error: `La categoría "${category.name}" no tiene crucigramas disponibles.` });
    }

    // 4. Elegir un crucigrama al azar de la categoría
    const randomCrossword =
      category.crosswords[Math.floor(Math.random() * category.crosswords.length)];

    // 5. Crear el Game en PostgreSQL (Prisma)
    const parsedDuration = mode === 'TIMED' ? parseInt(duration, 10) : null;

    const game = await prisma.game.create({
      data: {
        crosswordId: randomCrossword.id,
        mode,
        status: 'WAITING',
        duration: parsedDuration,
      },
      select: {
        id: true,
        mode: true,
        status: true,
        duration: true,
        createdAt: true,
        crossword: { select: { id: true, name: true } },
      },
    });

    // 6. Inicializar el estado efímero en Redis
    await createGameState(game.id, {
      mode: game.mode,
      crosswordId: game.crossword.id,
      duration: game.duration ?? undefined,
    });

    // 7. Responder
    return res.status(201).json({
      gameId: game.id,
      shareUrl: `/play/${game.id}`,
      crossword: game.crossword,
      mode: game.mode,
      duration: game.duration,
      status: game.status,
      createdAt: game.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/games/:gameId ──────────────────────────────────────────────────
/**
 * Devuelve la información básica de una partida (pantalla previa a unirse).
 */
router.get('/:gameId', async (req, res, next) => {
  try {
    const { gameId } = req.params;

    // Consultar en Prisma (fuente de verdad para datos persistentes)
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        crossword: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
        players: {
          select: { id: true, name: true, score: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: `Partida con id "${gameId}" no encontrada.` });
    }

    // Enriquecer con el estado en vivo desde Redis (si está disponible)
    const liveState = await getGameMeta(gameId);

    return res.status(200).json({
      gameId: game.id,
      mode: game.mode,
      status: liveState?.status ?? game.status, // Redis tiene la verdad en vivo
      duration: game.duration,
      crossword: game.crossword,
      players: game.players,
      createdAt: game.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/games/:gameId/join ─────────────────────────────────────────────────
/**
 * Un invitado se une a una partida ingresando solo su nombre.
 * Body: { name: string }
 * Respuesta: { playerId, name, gameId, token, crossword }
 */
router.post('/:gameId/join', async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { name } = req.body;

    // 1. Validar el nombre
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name es requerido y no puede estar vacío.' });
    }
    const trimmedName = name.trim();

    // 2. Verificar que la partida exista en Prisma
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        crossword: {
          include: { words: true },
        },
      },
    });

    if (!game) {
      return res.status(404).json({ error: `Partida con id "${gameId}" no encontrada.` });
    }

    // 3. Verificar el estado en vivo desde Redis
    const liveState = await getGameMeta(gameId);
    const currentStatus = liveState?.status ?? game.status;

    if (currentStatus === 'FINISHED') {
      return res.status(409).json({ error: 'No puedes unirte a una partida que ya ha terminado.' });
    }

    // 4. Verificar que el nombre no esté ya en uso en esta partida (Redis es la fuente de verdad en vivo)
    const existingPlayers = await getPlayers(gameId);
    const nameAlreadyTaken = existingPlayers.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameAlreadyTaken) {
      return res.status(409).json({ error: `El nombre "${trimmedName}" ya está en uso en esta partida.` });
    }

    // 5. Crear el Player en Prisma (persistencia permanente)
    const player = await prisma.player.create({
      data: {
        gameId,
        name: trimmedName,
      },
    });

    // 6. Registrar el jugador en Redis (estado en vivo)
    await addPlayer(gameId, player.id, { name: trimmedName });

    // 7. Generar token de sesión
    const token = generateToken({
      playerId: player.id,
      gameId,
      name: trimmedName,
    });

    // 8. Responder con token + datos del crucigrama (para que el frontend construya el grid)
    return res.status(201).json({
      playerId: player.id,
      name: trimmedName,
      gameId,
      token,
      crossword: {
        id: game.crossword.id,
        name: game.crossword.name,
        words: game.crossword.words.map((w) => ({
          id: w.id,
          clue: w.clue,
          direction: w.direction,
          row: w.row,
          col: w.col,
          // NO enviamos 'word' (la respuesta correcta) al cliente
          length: w.word.length,
        })),
      },
    });
  } catch (err) {
    // Capturar violación de unique constraint (nombre duplicado a nivel DB)
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'El nombre ya está en uso en esta partida.' });
    }
    next(err);
  }
});

module.exports = router;
