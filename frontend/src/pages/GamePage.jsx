import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { joinGame } from '../api';
import { useSocket } from '../hooks/useSocket';
import CrosswordGrid from '../components/CrosswordGrid';
import Leaderboard from '../components/Leaderboard';
import Chat from '../components/Chat';
import './GamePage.css';

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  // ── Sesión ─────────────────────────────────────────────────
  const [session, setSession] = useState(null);       // { playerId, name, token, crossword }
  const [nameInput, setNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // ── Estado de juego ────────────────────────────────────────
  const [grid, setGrid]       = useState({});         // { "row:col": "LETRA" }
  const [correct, setCorrect] = useState({});         // celdas correctas { "row:col": true }
  const [wrong, setWrong]     = useState({});         // celdas incorrectas
  const [players, setPlayers] = useState([]);         // leaderboard en vivo
  const [messages, setMessages] = useState([]);       // chat
  const [timeLeft, setTimeLeft] = useState(null);     // segundos restantes
  const [gameStatus, setGameStatus] = useState('WAITING');
  const wrongTimers = useRef({});

  // Calcular las palabras con su numeración estricta (Horizontales primero, Verticales después)
  const numberedWords = useMemo(() => {
    const w = session?.crossword?.words || [];
    // Deep copy to avoid mutating session storage object
    const words = JSON.parse(JSON.stringify(w)); 
    let currentNumber = 1;
    
    // Asignar a Horizontales
    const across = words.filter(word => word.direction === 'ACROSS')
                        .sort((a, b) => a.row - b.row || a.col - b.col);
    across.forEach(word => word.number = currentNumber++);
    
    // Asignar a Verticales
    const down = words.filter(word => word.direction === 'DOWN')
                      .sort((a, b) => a.row - b.row || a.col - b.col);
    down.forEach(word => word.number = currentNumber++);
    
    return words;
  }, [session?.crossword?.words]);

  // Cargar sesión guardada (si ya se unió desde LobbyPage o recarga)
  useEffect(() => {
    const raw = sessionStorage.getItem(`session:${gameId}`);
    if (raw) setSession(JSON.parse(raw));
  }, [gameId]);

  // ── Handlers de Socket.io ──────────────────────────────────
  const handleGameState = useCallback((data) => {
    setGrid(data.grid || {});
    setGameStatus(data.status);
    setPlayers(data.players || []);
  }, []);

  const handleCellUpdated = useCallback(({ row, col, letter, correct: isCorrect }) => {
    const key = `${row}:${col}`;
    setGrid((g) => ({ ...g, [key]: letter }));

    if (isCorrect) {
      setCorrect((c) => ({ ...c, [key]: true }));
      setWrong((w) => { const n = { ...w }; delete n[key]; return n; });
    } else {
      setWrong((w) => ({ ...w, [key]: true }));
      // Limpiar el estado "incorrecto" después de 1.5s
      clearTimeout(wrongTimers.current[key]);
      wrongTimers.current[key] = setTimeout(() => {
        setWrong((w) => { const n = { ...w }; delete n[key]; return n; });
      }, 1500);
    }
  }, []);

  const handleStatsUpdate = useCallback((ranked) => setPlayers(ranked), []);

  const handleChatMessage = useCallback((msg) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const handleTimerSync = useCallback(({ timeLeft }) => setTimeLeft(timeLeft), []);

  const handleGameEnded = useCallback(({ reason }) => {
    setGameStatus('FINISHED');
    setTimeout(() => navigate(`/results/${gameId}`), 2000);
  }, [gameId, navigate]);

  // ── Socket ─────────────────────────────────────────────────
  const { connected, sendCell, sendChat } = useSocket(
    session ? gameId : null,
    session?.token ?? null,
    {
      'game:state':   handleGameState,
      'cell:updated': handleCellUpdated,
      'stats:update': handleStatsUpdate,
      'chat:message': handleChatMessage,
      'timer:sync':   handleTimerSync,
      'game:ended':   handleGameEnded,
    }
  );

  // ── Join directo desde /play/:gameId ───────────────────────
  const handleDirectJoin = async () => {
    if (!nameInput.trim()) { setJoinError('Ingresa tu nombre.'); return; }
    setJoining(true); setJoinError('');
    try {
      const s = await joinGame(gameId, nameInput.trim());
      sessionStorage.setItem(`session:${gameId}`, JSON.stringify(s));
      setSession(s);
    } catch (e) {
      setJoinError(e.response?.data?.error || 'Error al unirse.');
    } finally {
      setJoining(false);
    }
  };

  // ── Formatear tiempo ───────────────────────────────────────
  const formatTime = (s) => s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ═══ Sin sesión: formulario de unión rápida ═══════════════
  if (!session) return (
    <div className="game-join-screen fade-in">
      <div className="glass game-join-card">
        <h1 className="game-join-title">Únete a la partida</h1>
        <p className="game-join-sub">Ingresa tu nombre para comenzar a jugar.</p>
        <input
          className="input"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDirectJoin()}
          placeholder="Tu nombre…"
          maxLength={20}
          autoFocus
        />
        {joinError && <p className="join-error">{joinError}</p>}
        <button className="btn btn-primary" onClick={handleDirectJoin} disabled={joining}>
          {joining ? 'Uniéndose…' : '🎮 Entrar'}
        </button>
      </div>
    </div>
  );

  // ═══ Pantalla de juego completa ════════════════════════════
  return (
    <div className="game-page">
      {/* Header */}
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-title">{session.crossword?.name || 'Crucigrama'}</span>
          <span className={`badge ${connected ? 'badge-success' : 'badge-error'}`}>
            {connected ? '● En vivo' : '● Reconectando…'}
          </span>
        </div>
        <div className="game-header-right">
          {gameStatus === 'FINISHED' && <span className="badge badge-warning">¡Partida terminada!</span>}
          {timeLeft != null && (
            <div className={`timer ${timeLeft <= 10 ? 'timer--urgent' : ''}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
          <span className="game-player-chip">👤 {session.name}</span>
        </div>
      </header>

      {/* Body */}
      <div className="game-body">
        {/* Grid + pistas */}
        <main className="game-main">
          <div className="grid-wrapper">
            <CrosswordGrid
              words={numberedWords}
              grid={grid}
              correct={correct}
              wrong={wrong}
              readOnly={gameStatus === 'FINISHED'}
              onCell={sendCell}
            />
          </div>

          {/* Pistas */}
          <div className="clues-panel glass">
            {['ACROSS', 'DOWN'].map((dir) => {
              const dirWords = numberedWords.filter((w) => w.direction === dir);
              if (!dirWords.length) return null;
              return (
                <div key={dir} className="clues-group">
                  <h4 className="clues-title">{dir === 'ACROSS' ? '→ Horizontales' : '↓ Verticales'}</h4>
                  <ul className="clues-list">
                    {dirWords.map((w) => (
                      <li key={w.id} className="clue-item">
                        <span className="clue-num">{w.number}.</span>
                        <span className="clue-text">{w.clue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </main>

        {/* Panel lateral */}
        <aside className="game-sidebar">
          <div className="sidebar-panel glass">
            <Leaderboard players={players} myPlayerId={session.playerId} />
          </div>
          <div className="sidebar-panel glass sidebar-chat">
            <Chat
              messages={messages}
              myPlayerId={session.playerId}
              onSend={sendChat}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
