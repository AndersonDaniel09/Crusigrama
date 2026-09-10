import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLeaderboard } from '../api';
import './ResultsPage.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ResultsPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const session = JSON.parse(sessionStorage.getItem(`session:${gameId}`) || 'null');

  useEffect(() => {
    getLeaderboard(gameId)
      .then(setData)
      .catch((e) => {
        const msg = e.response?.data?.error || 'Error al cargar resultados.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) return <div className="loading-center"><div className="spinner" /><span>Cargando resultados…</span></div>;
  if (error)   return <div className="loading-center"><p style={{ color: 'var(--error)' }}>{error}</p></div>;

  const { leaderboard = [] } = data;
  const podium = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);

  return (
    <div className="results-page fade-in">
      <div className="results-card">

        <div className="results-header">
          <div className="results-trophy">🏆</div>
          <h1 className="results-title">¡Partida finalizada!</h1>
          <p className="results-subtitle">
            {session?.name
              ? `Bien jugado, ${session.name}.`
              : 'Aquí está la clasificación final.'}
          </p>
        </div>

        {/* Podio */}
        {podium.length > 0 && (
          <div className="podium">
            {podium.map((p) => {
              const isMe = p.playerId === session?.playerId;
              return (
                <div key={p.playerId} className={`podium-card glass ${isMe ? 'podium-card--me' : ''}`}>
                  <span className="podium-medal">{MEDALS[p.rank - 1] || `#${p.rank}`}</span>
                  <span className="podium-name">{p.name}{isMe && ' ⭐'}</span>
                  <span className="podium-score">{p.score} aciertos</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Resto de jugadores */}
        {rest.length > 0 && (
          <div className="results-rest glass">
            {rest.map((p) => {
              const isMe = p.playerId === session?.playerId;
              return (
                <div key={p.playerId} className={`results-row ${isMe ? 'results-row--me' : ''}`}>
                  <span className="results-rank">#{p.rank}</span>
                  <span className="results-name">{p.name}</span>
                  <span className="results-score">{p.score} ✓</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="results-actions">
          <Link to="/" className="btn btn-primary">🎮 Nueva partida</Link>
        </div>
      </div>
    </div>
  );
}
