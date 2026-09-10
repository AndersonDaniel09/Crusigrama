import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGame, joinGame } from '../api';
import './LobbyPage.css';

export default function LobbyPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/play/${gameId}`;

  useEffect(() => {
    getGame(gameId)
      .then(setGame)
      .catch(() => setError('Partida no encontrada.'))
      .finally(() => setLoading(false));
  }, [gameId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError('Ingresa tu nombre.'); return; }
    setJoining(true); setError('');
    try {
      const session = await joinGame(gameId, name.trim());
      // Guardar sesión en sessionStorage (se limpia al cerrar la pestaña)
      sessionStorage.setItem(`session:${gameId}`, JSON.stringify(session));
      navigate(`/play/${gameId}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al unirse.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div className="lobby-page fade-in">
      <div className="lobby-card glass">
        <div className="lobby-badge-row">
          <span className={`badge ${game?.mode === 'TIMED' ? 'badge-warning' : 'badge-accent'}`}>
            {game?.mode === 'TIMED' ? `⏱ ${game.duration}s` : '♾️ Modo Libre'}
          </span>
          <span className="badge badge-purple">{game?.crossword?.name}</span>
        </div>

        <h1 className="lobby-title">¡Partida lista!</h1>
        <p className="lobby-subtitle">Comparte el enlace con tus amigos para que se unan.</p>

        {/* Share Link */}
        <div className="share-box">
          <span className="share-url">{shareUrl}</span>
          <button className="btn btn-secondary share-copy" onClick={handleCopy}>
            {copied ? '✅ Copiado' : '📋 Copiar'}
          </button>
        </div>

        <div className="lobby-divider">
          <span>Ingresa tu nombre para empezar</span>
        </div>

        {/* Nombre del creador */}
        <div className="lobby-form">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Tu nombre en el juego…"
            maxLength={20}
            autoFocus
          />
          {error && <p className="lobby-error">{error}</p>}
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={joining || !name.trim()}
          >
            {joining ? 'Uniéndose…' : '🎮 Entrar al juego'}
          </button>
        </div>

        {game?.players?.length > 0 && (
          <p className="lobby-waiting">
            {game.players.length} jugador{game.players.length !== 1 ? 'es' : ''} esperando…
          </p>
        )}
      </div>
    </div>
  );
}
