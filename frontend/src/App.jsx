import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';

/**
 * Rutas de la aplicación.
 * Se irán agregando en etapas posteriores:
 *   /categories        → Etapa 9
 *   /games/new         → Etapa 9
 *   /play/:gameId      → Etapa 9
 *   /results/:gameId   → Etapa 9
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Placeholder — rutas completas en Etapa 9 */}
    </Routes>
  );
}

export default App;
