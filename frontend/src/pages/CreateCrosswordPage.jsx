import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateCrosswordWithAI, createCustomCrossword, getCategories } from '../api';
import { generateLayout } from '../utils/layout';
import CrosswordGrid from '../components/CrosswordGrid';
import './CreateCrosswordPage.css';

export default function CreateCrosswordPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [wordsList, setWordsList] = useState([]);   // [{ word, clue }]
  const [placedWords, setPlacedWords] = useState([]); // con row, col, direction

  // Cargar categorías
  useEffect(() => {
    getCategories()
      .then(cats => {
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      })
      .catch(console.error);
  }, []);

  // Generar con IA
  const handleGenerateAI = async () => {
    if (!topic.trim()) return alert('Ingresa un tema primero.');
    setIsGenerating(true);
    try {
      const data = await generateCrosswordWithAI(topic.trim(), difficulty);
      const newWords = data.words;
      setWordsList(newWords);
      // Auto-layout
      const layout = generateLayout(newWords);
      setPlacedWords(layout);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Error desconocido';
      alert('Error al generar con IA: ' + msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Agregar palabra manualmente
  const handleAddWord = () => {
    setWordsList(prev => [...prev, { word: '', clue: '' }]);
  };

  const handleWordChange = (index, field, value) => {
    setWordsList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === 'word' ? value.toUpperCase() : value };
      return next;
    });
  };

  const handleRemoveWord = (index) => {
    setWordsList(prev => prev.filter((_, i) => i !== index));
    setPlacedWords([]);
  };

  const handleUpdateLayout = () => {
    const filtered = wordsList.filter(w => w.word.length >= 2);
    const layout = generateLayout(filtered);
    setPlacedWords(layout);
  };

  // Guardar
  const handleSave = async () => {
    if (!name.trim()) return alert('Ingresa un nombre para el crucigrama.');
    if (!categoryId) return alert('Selecciona una categoría.');
    if (placedWords.length === 0) return alert('Genera o agrega palabras primero.');

    setIsSaving(true);
    try {
      const result = await createCustomCrossword({
        name: name.trim(),
        categoryId,
        difficulty,
        words: placedWords,
      });
      alert('✅ ¡Crucigrama guardado exitosamente! ID: ' + result.crosswordId);
      navigate('/');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Error desconocido';
      alert('Error al guardar: ' + msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="create-page">
      {/* Header */}
      <header className="create-header">
        <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>← Volver</button>
        <div>
          <h1 className="title">✨ Crear Crucigrama</h1>
          <p className="subtitle">Usa Inteligencia Artificial o crea el tuyo manualmente</p>
        </div>
      </header>

      <div className="create-layout">
        {/* Sidebar de configuración */}
        <aside className="create-sidebar glass">

          {/* Sección 1: Config general */}
          <section className="form-section">
            <h3 className="section-title">📋 Configuración</h3>

            <label className="field-label">Nombre del crucigrama</label>
            <input
              type="text"
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Planetas del sistema solar"
            />

            <label className="field-label">Categoría</label>
            <select className="field-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">Cargando...</option>}
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label className="field-label">Dificultad</label>
            <div className="diff-row">
              {[['EASY', '🟢 Baja'], ['MEDIUM', '🟡 Media'], ['HARD', '🔴 Alta']].map(([val, label]) => (
                <button
                  key={val}
                  className={`btn ${difficulty === val ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDifficulty(val)}
                >{label}</button>
              ))}
            </div>
          </section>

          {/* Sección 2: Generador IA */}
          <section className="form-section ai-section">
            <h3 className="section-title">🤖 Generador con IA</h3>
            <label className="field-label">Tema para generar palabras</label>
            <input
              type="text"
              className="field-input"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ej. El universo, Fútbol, Historia..."
              onKeyDown={e => e.key === 'Enter' && handleGenerateAI()}
            />
            <button
              className="btn btn-primary"
              onClick={handleGenerateAI}
              disabled={isGenerating}
              style={{ width: '100%' }}
            >
              {isGenerating ? '⏳ Generando palabras...' : '✨ Generar con IA'}
            </button>
            {isGenerating && (
              <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                Consultando a Gemini AI...
              </p>
            )}
          </section>

          {/* Guardar */}
          <button
            className="btn btn-primary save-btn"
            onClick={handleSave}
            disabled={isSaving || placedWords.length === 0}
          >
            {isSaving ? 'Guardando...' : '💾 Guardar Crucigrama'}
          </button>
        </aside>

        {/* Panel principal */}
        <main className="create-main">

          {/* Editor de palabras */}
          <section className="words-editor glass">
            <div className="words-editor-header">
              <h3 className="section-title">📝 Palabras y Pistas ({wordsList.length})</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={handleAddWord}>+ Agregar</button>
                <button className="btn btn-secondary" onClick={handleUpdateLayout} disabled={wordsList.length === 0}>
                  🔄 Actualizar tablero
                </button>
              </div>
            </div>

            {wordsList.length === 0 ? (
              <p className="empty-hint">Genera palabras con IA o agrégalas manualmente con el botón de arriba.</p>
            ) : (
              <div className="words-table">
                <div className="words-table-header">
                  <span>Palabra</span>
                  <span>Pista</span>
                  <span></span>
                </div>
                {wordsList.map((w, i) => (
                  <div key={i} className="word-row">
                    <input
                      className="field-input input-word"
                      value={w.word}
                      onChange={e => handleWordChange(i, 'word', e.target.value)}
                      placeholder="PALABRA"
                    />
                    <input
                      className="field-input input-clue"
                      value={w.clue}
                      onChange={e => handleWordChange(i, 'clue', e.target.value)}
                      placeholder="Escribe la pista..."
                    />
                    <button className="btn-remove" onClick={() => handleRemoveWord(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vista previa del tablero */}
          <section className="preview-section glass">
            <h3 className="section-title">🔍 Vista Previa del Tablero</h3>
            {placedWords.length > 0 ? (
              <>
                <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {placedWords.length} de {wordsList.length} palabras colocadas. Las palabras que no encajan son ignoradas.
                </p>
                <div className="preview-grid-wrapper">
                  <CrosswordGrid words={placedWords} readOnly={true} />
                </div>
              </>
            ) : (
              <div className="preview-empty">
                <span style={{ fontSize: '3rem' }}>📐</span>
                <p>El tablero aparecerá aquí una vez que hayas generado o agregado palabras.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
