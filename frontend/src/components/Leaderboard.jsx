import './Leaderboard.css';

/** @param {{ players: Array<{rank,playerId,name,score}>, myPlayerId: string }} */
export default function Leaderboard({ players = [], myPlayerId }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="leaderboard">
      <h3 className="lb-title">Clasificación</h3>
      {players.length === 0 ? (
        <p className="lb-empty">Aún no hay puntos</p>
      ) : (
        <ol className="lb-list">
          {players.map((p) => {
            const isMe = p.playerId === myPlayerId;
            return (
              <li key={p.playerId} className={`lb-row ${isMe ? 'lb-row--me' : ''}`}>
                <span className="lb-rank">
                  {p.rank <= 3 ? medals[p.rank - 1] : `#${p.rank}`}
                </span>
                <span className="lb-name">{p.name}{isMe && <em> (tú)</em>}</span>
                <span className="lb-score">{p.score} ✓</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
