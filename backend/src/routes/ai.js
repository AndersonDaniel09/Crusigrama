const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

/**
 * POST /api/ai/generate-crossword
 * Genera palabras y pistas para un crucigrama basado en una temática y dificultad.
 */
router.post('/generate-crossword', async (req, res) => {
  try {
    const { topic, difficulty } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Debes proporcionar un tema (topic).' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'La API Key de Gemini no está configurada en el backend.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Definir la cantidad de palabras según la dificultad
    let numWords = 8;
    let difficultyDesc = "términos comunes y conocidos";
    
    if (difficulty === 'EASY') {
      numWords = 6;
      difficultyDesc = "términos muy fáciles y comunes";
    } else if (difficulty === 'MEDIUM') {
      numWords = 10;
      difficultyDesc = "términos de dificultad media";
    } else if (difficulty === 'HARD') {
      numWords = 12;
      difficultyDesc = "términos avanzados o poco comunes";
    }

    const prompt = `Actúa como un creador experto de crucigramas. Genera una lista de ${numWords} palabras y sus pistas para un crucigrama sobre el tema: "${topic}".
La dificultad solicitada es: ${difficulty} (${difficultyDesc}).
Requisitos:
- Las palabras deben estar en MAYÚSCULAS y no contener espacios ni caracteres especiales.
- Las pistas deben ser claras y acordes a la dificultad.
- Devuelve ÚNICAMENTE un arreglo JSON válido con el formato: [{"word": "PALABRA", "clue": "Pista descriptiva"}, ...]
- No incluyas markdown, código extra ni texto adicional.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
          responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    let jsonArray;
    try {
      jsonArray = JSON.parse(text);
    } catch (e) {
      // Intentar limpiar la respuesta si Gemini devuelve markdown accidentalmente
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      jsonArray = JSON.parse(cleaned);
    }

    if (!Array.isArray(jsonArray)) {
        return res.status(500).json({ error: 'La respuesta de la IA no es un arreglo válido.' });
    }

    return res.status(200).json({ words: jsonArray });
  } catch (error) {
    console.error('Error al generar crucigrama con IA:', error);
    return res.status(500).json({ error: 'Error al contactar a la Inteligencia Artificial.' });
  }
});

module.exports = router;
