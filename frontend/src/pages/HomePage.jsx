import './HomePage.css';

/**
 * Página de inicio — placeholder visual para Etapa 0.
 * Se reemplazará con el flujo completo en Etapa 9.
 */
function HomePage() {
  return (
    <main className="home">
      {/* Fondo animado */}
      <div className="home__bg" aria-hidden="true">
        <div className="home__blob home__blob--1" />
        <div className="home__blob home__blob--2" />
        <div className="home__grid" />
      </div>

      <div className="container home__content">
        {/* Badge */}
        <span className="home__badge">🚧 En construcción — Etapa 0</span>

        {/* Título */}
        <h1 className="home__title">
          Crucigramas<br />
          <span className="home__title--gradient">Multijugador</span>
        </h1>

        <p className="home__subtitle">
          Compite en tiempo real con tus amigos.<br />
          Elige una categoría, crea la partida y comparte el enlace.
        </p>

        {/* CTA — funcional en Etapa 9 */}
        <div className="home__actions">
          <button className="btn btn-primary" disabled>
            ✦ Crear partida
          </button>
          <button className="btn btn-secondary" disabled>
            Unirme con código
          </button>
        </div>

        {/* Características */}
        <div className="home__features">
          {[
            { icon: '⚡', title: 'Tiempo real', desc: 'Sincronización instantánea del grid con Socket.io' },
            { icon: '🏆', title: 'Clasificación en vivo', desc: 'Leaderboard actualizado jugada a jugada' },
            { icon: '💬', title: 'Chat de partida', desc: 'Conversa con otros jugadores durante la partida' },
            { icon: '🎯', title: 'Dos modos', desc: 'Contrarreloj o modo libre sin límite de tiempo' },
          ].map(({ icon, title, desc }) => (
            <div className="feature-card" key={title}>
              <span className="feature-card__icon">{icon}</span>
              <h3 className="feature-card__title">{title}</h3>
              <p className="feature-card__desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default HomePage;
