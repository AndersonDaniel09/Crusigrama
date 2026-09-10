const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed masivo de la base de datos (V2.0)...');

  // Limpiar la base de datos para asegurar un entorno limpio
  await prisma.player.deleteMany();
  await prisma.game.deleteMany();
  await prisma.crosswordWord.deleteMany();
  await prisma.crossword.deleteMany();
  await prisma.category.deleteMany();

  // 1. Crear Categorías
  const catTecnologia = await prisma.category.create({
    data: { name: 'Tecnología', description: 'Terminología básica de informática y computación.' }
  });
  
  const catCultura = await prisma.category.create({
    data: { name: 'Cultura General', description: 'Demuestra cuánto sabes del mundo.' }
  });

  const catGeografia = await prisma.category.create({
    data: { name: 'Geografía', description: 'Países, capitales y accidentes geográficos.' }
  });

  // 2. Crucigramas de Tecnología
  await prisma.crossword.create({
    data: {
      name: 'Hardware y Software Básico',
      categoryId: catTecnologia.id,
      difficulty: 'EASY',
      words: {
        create: [
          { word: 'CPU', clue: 'Cerebro de la computadora.', direction: 'ACROSS', row: 0, col: 0 },
          { word: 'CODIGO', clue: 'Instrucciones escritas por un programador.', direction: 'DOWN', row: 0, col: 0 },
          { word: 'RAM', clue: 'Memoria temporal de acceso aleatorio.', direction: 'ACROSS', row: 2, col: 0 },
          { word: 'DATOS', clue: 'Información procesada por una computadora.', direction: 'ACROSS', row: 4, col: 0 },
          { word: 'OS', clue: 'Sistema Operativo (siglas).', direction: 'DOWN', row: 4, col: 3 }
        ]
      }
    }
  });

  await prisma.crossword.create({
    data: {
      name: 'Lenguajes y Web',
      categoryId: catTecnologia.id,
      difficulty: 'MEDIUM',
      words: {
        create: [
          { word: 'HTML', clue: 'Lenguaje de marcado web.', direction: 'ACROSS', row: 0, col: 0 },
          { word: 'HTTP', clue: 'Protocolo de transferencia de hipertexto.', direction: 'DOWN', row: 0, col: 0 },
          { word: 'CSS', clue: 'Da estilo a las páginas web.', direction: 'ACROSS', row: 2, col: 1 },
          { word: 'API', clue: 'Interfaz de programación de aplicaciones.', direction: 'ACROSS', row: 1, col: 4 },
          { word: 'PYTHON', clue: 'Lenguaje con logo de serpiente.', direction: 'DOWN', row: 0, col: 5 }
        ]
      }
    }
  });

  // 3. Crucigramas de Cultura General
  await prisma.crossword.create({
    data: {
      name: 'Pintores y Obras',
      categoryId: catCultura.id,
      difficulty: 'HARD',
      words: {
        create: [
          { word: 'PICASSO', clue: 'Pintor español del Guernica.', direction: 'ACROSS', row: 0, col: 0 },
          { word: 'DALI', clue: 'Maestro del surrealismo (relojes blandos).', direction: 'DOWN', row: 0, col: 6 },
          { word: 'MONALISA', clue: 'Famoso cuadro de Da Vinci.', direction: 'ACROSS', row: 2, col: 2 },
          { word: 'ARTE', clue: 'Lo que hacen estos personajes.', direction: 'DOWN', row: 1, col: 4 }
        ]
      }
    }
  });

  // 4. Geografía
  await prisma.crossword.create({
    data: {
      name: 'Países de América',
      categoryId: catGeografia.id,
      difficulty: 'EASY',
      words: {
        create: [
          { word: 'MEXICO', clue: 'País de los aztecas.', direction: 'ACROSS', row: 0, col: 0 },
          { word: 'CHILE', clue: 'País muy largo y estrecho de Sudamérica.', direction: 'DOWN', row: 0, col: 4 },
          { word: 'COLOMBIA', clue: 'País del realismo mágico y el café.', direction: 'ACROSS', row: 2, col: 0 },
          { word: 'BRASIL', clue: 'El país más grande de Sudamérica.', direction: 'DOWN', row: 1, col: 7 },
          { word: 'LIMA', clue: 'Capital de Perú.', direction: 'ACROSS', row: 4, col: 5 }
        ]
      }
    }
  });

  console.log('Seed masivo completado satisfactoriamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
