import { useRef, useEffect, useMemo } from 'react';
import './CrosswordGrid.css';

/**
 * Tablero del crucigrama.
 *
 * @param {object[]} words   - Palabras del crucigrama (sin campo 'word')
 *                             [{ id, clue, direction, row, col, length }]
 * @param {object}   grid    - Estado actual { "row:col": "LETRA" }
 * @param {object}   correct - Celdas confirmadas correctas { "row:col": true }
 * @param {object}   wrong   - Celdas confirmadas incorrectas { "row:col": true }
 * @param {boolean}  readOnly
 * @param {function} onCell  - (row, col, letter) => void
 */
export default function CrosswordGrid({ words = [], grid = {}, correct = {}, wrong = {}, readOnly = false, onCell }) {
  const inputRefs = useRef({});

  // Calcular las dimensiones del grid y asignar números estrictos a las palabras
  const { cells, maxRow, maxCol } = useMemo(() => {
    const cells = new Map();
    let maxRow = 0, maxCol = 0;

    // 1. Asignar números secuenciales estrictos (Horizontales primero, luego Verticales)
    let currentNumber = 1;
    
    // Filtrar y ordenar Horizontales (ACROSS)
    const acrossWords = words.filter(w => w.direction === 'ACROSS')
                             .sort((a, b) => a.row - b.row || a.col - b.col);
    acrossWords.forEach(w => w.number = currentNumber++);

    // Filtrar y ordenar Verticales (DOWN)
    const downWords = words.filter(w => w.direction === 'DOWN')
                           .sort((a, b) => a.row - b.row || a.col - b.col);
    downWords.forEach(w => w.number = currentNumber++);

    // 2. Construir el grid de celdas
    words.forEach((w) => {
      for (let i = 0; i < w.length; i++) {
        const r = w.direction === 'DOWN'   ? w.row + i : w.row;
        const c = w.direction === 'ACROSS' ? w.col + i : w.col;
        const key = `${r}:${c}`;
        
        if (!cells.has(key)) {
          cells.set(key, { row: r, col: c, numbers: [] });
        }
        
        // Marcar inicio de palabra con su número asignado
        if (i === 0) {
          cells.get(key).numbers.push(w.number);
        }
        
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      }
    });

    return { cells, maxRow, maxCol };
  }, [words]);

  const handleKey = (e, row, col) => {
    const { key } = e;

    if (/^[a-záéíóúñüA-ZÁÉÍÓÚÑÜ]$/.test(key)) {
      const letter = key.toUpperCase();
      onCell?.(row, col, letter);
      // Mover foco a la siguiente celda horizontal
      const nextKey = `${row}:${col + 1}`;
      inputRefs.current[nextKey]?.focus();
    } else if (key === 'Backspace') {
      onCell?.(row, col, '');
      const prevKey = `${row}:${col - 1}`;
      inputRefs.current[prevKey]?.focus();
    } else if (key === 'ArrowRight')  inputRefs.current[`${row}:${col + 1}`]?.focus();
    else if (key === 'ArrowLeft')  inputRefs.current[`${row}:${col - 1}`]?.focus();
    else if (key === 'ArrowDown')  inputRefs.current[`${row + 1}:${col}`]?.focus();
    else if (key === 'ArrowUp')    inputRefs.current[`${row - 1}:${col}`]?.focus();
  };

  const rows = Array.from({ length: maxRow + 1 }, (_, r) => r);
  const cols = Array.from({ length: maxCol + 1 }, (_, c) => c);

  return (
    <div className="crossword-grid" style={{ '--cols': maxCol + 1 }}>
      {rows.map((r) =>
        cols.map((c) => {
          const key = `${r}:${c}`;
          const cell = cells.get(key);

          if (!cell) return <div key={key} className="cell cell-empty" />;

          const letter = grid[key] || '';
          const isCorrect = correct[key];
          const isWrong   = wrong[key];

          return (
            <div
              key={key}
              className={[
                'cell',
                'cell-active',
                isCorrect ? 'cell-correct' : '',
                isWrong   ? 'cell-wrong'   : '',
              ].join(' ')}
            >
              {cell.numbers && cell.numbers.length > 0 && (
                <span className="cell-number">{cell.numbers.join('/')}</span>
              )}
              <input
                ref={(el) => { inputRefs.current[key] = el; }}
                className="cell-input"
                maxLength={1}
                value={letter}
                readOnly={readOnly || isCorrect}
                onChange={() => {}}
                onKeyDown={(e) => !readOnly && handleKey(e, r, c)}
                onFocus={(e) => e.target.select()}
                aria-label={`Celda fila ${r} columna ${c}`}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
