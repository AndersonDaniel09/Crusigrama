import { Routes, Route, Navigate } from 'react-router-dom';
import SelectPage  from './pages/SelectPage.jsx';
import LobbyPage   from './pages/LobbyPage.jsx';
import GamePage    from './pages/GamePage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import CreateCrosswordPage from './pages/CreateCrosswordPage.jsx';

function App() {
  return (
    <Routes>
      {/* Selección de categoría y modo */}
      <Route path="/"                        element={<SelectPage />} />

      {/* Crear crucigrama */}
      <Route path="/create-crossword"        element={<CreateCrosswordPage />} />

      {/* Lobby tras crear partida: comparte el enlace y entra */}
      <Route path="/games/:gameId/lobby"     element={<LobbyPage />} />

      {/* Tablero de juego en tiempo real */}
      <Route path="/play/:gameId"            element={<GamePage />} />

      {/* Resultados finales */}
      <Route path="/results/:gameId"         element={<ResultsPage />} />

      {/* Cualquier ruta desconocida → home */}
      <Route path="*"                        element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
