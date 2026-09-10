import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategories, createGame } from '../api';
import './SelectPage.css';

const MODES = [
  { id: 'FREE',  label: 'Modo Libre',        icon: '♾️', desc: 'Sin límite de tiempo. Gana quien complete el crucigrama.' },
  { id: 'TIMED', label: 'Contrarreloj',      icon: '⏱️', desc: 'Elige cuánto tiempo tienen los jugadores.' },
];

const DURATIONS = [
  { value: 60,  label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];

export default function SelectPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMode, setSelectedMode] = useState('FREE');
  const [duration, setDuration] = useState(120);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!selectedCategory) { setError('Selecciona una categoría.'); return; }
    setCreating(true);
    setError('');
    try {
      const game = await createGame({
        categoryId: selectedCategory,
        mode: selectedMode,
        ...(selectedMode === 'TIMED' ? { duration } : {}),
      });
      navigate(`/games/${game.gameId}/lobby`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear la partida.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Cargando categorías…</span>
    </div>
  );

  return (
    <div className="select-page fade-in">
      <header className="select-header">
        <h1 className="select-title">
          <span className="title-accent">Crucigrama</span> Multijugador
        </h1>
        <p className="select-subtitle">Crea una partida, comparte el enlace y juega con amigos en tiempo real.</p>
      </header>

      <div className="select-body">
        {/* Categorías */}
        <section className="select-section">
          <h2 className="section-label">1. Elige una categoría</h2>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`category-card glass ${selectedCategory === cat.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="cat-name">{cat.name}</span>
                <span className="badge badge-accent">{cat.crosswordCount} crucigramas</span>
              </button>
            ))}
          </div>
        </section>

        {/* Modo */}
        <section className="select-section">
          <h2 className="section-label">2. Elige el modo de juego</h2>
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-card glass ${selectedMode === m.id ? 'selected' : ''}`}
                onClick={() => setSelectedMode(m.id)}
              >
                <span className="mode-icon">{m.icon}</span>
                <span className="mode-label">{m.label}</span>
                <span className="mode-desc">{m.desc}</span>
              </button>
            ))}
          </div>

          {selectedMode === 'TIMED' && (
            <div className="duration-row fade-in">
              <span className="section-label" style={{ marginBottom: 0 }}>Duración:</span>
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  className={`btn ${duration === d.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {error && <p className="select-error">{error}</p>}

        <button
          className="btn btn-primary btn-create"
          onClick={handleCreate}
          disabled={!selectedCategory || creating}
        >
          {creating ? 'Creando…' : '🎮 Crear partida'}
        </button>
      </div>
    </div>
  );
}
