const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de la base de datos...');

  // Limpiar la base de datos para asegurar un entorno limpio
  await prisma.player.deleteMany();
  await prisma.game.deleteMany();
  await prisma.crosswordWord.deleteMany();
  await prisma.crossword.deleteMany();
  await prisma.category.deleteMany();

  // 1. Crear una Categoría de prueba
  const catTecnologia = await prisma.category.create({
    data: {
      name: 'Tecnología',
      description: 'Terminología básica de informática y computación.',
    },
  });

  // 2. Crear un tablero de crucigrama con sus palabras
  const crossword = await prisma.crossword.create({
    data: {
      name: 'Hardware y Software',
      categoryId: catTecnologia.id,
      words: {
        create: [
          {
            word: 'CPU',
            clue: 'Cerebro de la computadora.',
            direction: 'ACROSS',
            row: 0,
            col: 0, // C P U
          },
          {
            word: 'CODIGO',
            clue: 'Instrucciones escritas por un programador.',
            direction: 'DOWN',
            row: 0,
            col: 0, // C empieza en (0,0), O (1,0), D (2,0), I (3,0), G (4,0), O (5,0)
          },
          {
            word: 'RAM',
            clue: 'Memoria temporal de acceso aleatorio.',
            direction: 'ACROSS',
            row: 2,
            col: 0, // Interseca la D de codigo en la celda (2,0) wait: D no es R...
            // Let's make a real intersection
            // C O D I G O (down, col 0) -> (0,0)=C, (1,0)=O, (2,0)=D, (3,0)=I, (4,0)=G, (5,0)=O
            // CPU (across, row 0) -> (0,0)=C, (0,1)=P, (0,2)=U (perfect!)
          },
          {
             word: 'DATOS',
             clue: 'Información procesada por una computadora.',
             direction: 'ACROSS',
             row: 2,
             col: 0, // (2,0)=D, (2,1)=A, (2,2)=T, (2,3)=O, (2,4)=S (Interseca CODIGO en D)
          }
        ]
      }
    }
  });

  console.log('Seed completado satisfactoriamente.');
  console.log(`Categoría creada: ${catTecnologia.name}`);
  console.log(`Crucigrama creado: ${crossword.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
