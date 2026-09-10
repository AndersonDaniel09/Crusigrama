'use strict';

const { Router } = require('express');
const prisma = require('../db/prismaClient');

const router = Router();

/**
 * GET /api/categories
 * Devuelve todas las categorías con el número de crucigramas disponibles.
 */
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { crosswords: true },
        },
      },
    });

    const result = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      crosswordCount: cat._count.crosswords,
      createdAt: cat.createdAt,
    }));

    res.status(200).json({ categories: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
