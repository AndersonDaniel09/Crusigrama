/**
 * Intenta cruzar las palabras para formar un crucigrama.
 * Algoritmo Greedy básico:
 * 1. Coloca la primera palabra horizontalmente en el centro (0,0).
 * 2. Para cada palabra restante, busca todas las intersecciones posibles con las palabras ya colocadas.
 * 3. Si encuentra una intersección válida (sin conflictos con otras letras adyacentes), la coloca y pasa a la siguiente.
 * 4. Si una palabra no encaja en ningún lado, la ignora (o retorna error).
 * @param {Array<{word: string, clue: string}>} wordList 
 * @returns {Array<{word: string, clue: string, direction: string, row: number, col: number}>}
 */
export function generateLayout(wordList) {
  if (!wordList || wordList.length === 0) return [];
  
  // Ordenar de mayor a menor longitud ayuda al algoritmo greedy
  const sorted = [...wordList].sort((a, b) => b.word.length - a.word.length);
  
  const placedWords = [];
  const grid = new Map(); // "row:col" => "LETTER"
  
  const placeWord = (wordObj, row, col, direction) => {
    for (let i = 0; i < wordObj.word.length; i++) {
      const r = direction === 'DOWN' ? row + i : row;
      const c = direction === 'ACROSS' ? col + i : col;
      grid.set(`${r}:${c}`, wordObj.word[i]);
    }
    placedWords.push({ ...wordObj, row, col, direction });
  };
  
  const canPlace = (word, row, col, direction) => {
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'DOWN' ? row + i : row;
      const c = direction === 'ACROSS' ? col + i : col;
      const key = `${r}:${c}`;
      
      // Si la celda está ocupada, debe ser la misma letra
      if (grid.has(key) && grid.get(key) !== word[i]) return false;
      
      // Verificar celdas adyacentes si no es una intersección (para no pegar palabras)
      if (!grid.has(key)) {
        if (direction === 'ACROSS') {
          if (grid.has(`${r-1}:${c}`) || grid.has(`${r+1}:${c}`)) return false;
          if (i === 0 && grid.has(`${r}:${c-1}`)) return false; // Letra antes
          if (i === word.length - 1 && grid.has(`${r}:${c+1}`)) return false; // Letra después
        } else {
          if (grid.has(`${r}:${c-1}`) || grid.has(`${r}:${c+1}`)) return false;
          if (i === 0 && grid.has(`${r-1}:${c}`)) return false;
          if (i === word.length - 1 && grid.has(`${r+1}:${c}`)) return false;
        }
      }
    }
    return true;
  };

  // Colocar la primera palabra
  placeWord(sorted[0], 0, 0, 'ACROSS');
  
  // Intentar colocar las demás
  for (let i = 1; i < sorted.length; i++) {
    const currentWordObj = sorted[i];
    const word = currentWordObj.word;
    let placed = false;
    
    // Buscar intersecciones en palabras ya colocadas
    for (const pWord of placedWords) {
      if (placed) break;
      
      for (let pIdx = 0; pIdx < pWord.word.length; pIdx++) {
        if (placed) break;
        const pChar = pWord.word[pIdx];
        
        for (let wIdx = 0; wIdx < word.length; wIdx++) {
          if (word[wIdx] === pChar) {
            // Calcular posible posición inicial de la nueva palabra
            const newDir = pWord.direction === 'ACROSS' ? 'DOWN' : 'ACROSS';
            const startRow = pWord.direction === 'ACROSS' ? pWord.row - wIdx : pWord.row + pIdx;
            const startCol = pWord.direction === 'ACROSS' ? pWord.col + pIdx : pWord.col - wIdx;
            
            if (canPlace(word, startRow, startCol, newDir)) {
              placeWord(currentWordObj, startRow, startCol, newDir);
              placed = true;
              break;
            }
          }
        }
      }
    }
    // Si no se pudo colocar, podríamos reintentar o simplemente ignorarla en este algoritmo simple.
  }
  
  // Normalizar coordenadas para que no haya negativas y empiecen en 0
  if (placedWords.length > 0) {
    let minRow = Infinity;
    let minCol = Infinity;
    placedWords.forEach(pw => {
      minRow = Math.min(minRow, pw.row);
      minCol = Math.min(minCol, pw.col);
    });
    
    placedWords.forEach(pw => {
      pw.row -= minRow;
      pw.col -= minCol;
    });
  }
  
  return placedWords;
}
