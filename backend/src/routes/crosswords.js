const express = require('express');
const router = express.Router();
const prisma = require('../db/prismaClient');

/**
 * POST /api/crosswords
 * Crea un crucigrama personalizado en la base de datos.
 * Body esperado:
 * {
 *   name: string,
 *   categoryId: string,
 *   difficulty: "EASY" | "MEDIUM" | "HARD",
 *   words: [
 *     { word: string, clue: string, direction: "ACROSS"|"DOWN", row: number, col: number }
 *   ]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { name, categoryId, difficulty, words } = req.body;

    if (!name || !categoryId || !words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Datos de crucigrama incompletos o inválidos.' });
    }

    // Comprobar que la categoría existe
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ error: 'La categoría especificada no existe.' });
    }

    // Crear el crucigrama
    const newCrossword = await prisma.crossword.create({
      data: {
        name,
        categoryId,
        difficulty: difficulty || 'MEDIUM',
        isCustom: true,
        words: {
          create: words.map((w) => ({
            word: w.word.toUpperCase(),
            clue: w.clue,
            direction: w.direction,
            row: w.row,
            col: w.col,
          })),
        },
      },
    });

    return res.status(201).json({
      message: 'Crucigrama creado exitosamente.',
      crosswordId: newCrossword.id,
    });
  } catch (error) {
    console.error('Error al crear crucigrama personalizado:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
