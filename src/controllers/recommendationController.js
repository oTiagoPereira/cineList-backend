const axios = require("axios");
const { searchMovies, fetchMoviesDetailsById, fetchStreamingOptions } = require("../services/moviesService.js");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

function buildPrompt({ mode, preferences }) {
  let prompt = "Aja como um especialista em cinema. Quero 12 recomendações de filmes populares (amplamente conhecidos), sem limitar por ano. Responda em pt-BR. ";

  if (mode === 'single') {
    const p1 = preferences.user1;
    prompt += "Minhas preferências: ";
    if (p1.genres?.length) prompt += `Gêneros: ${p1.genres.join(', ')}. `;
    if (p1.actors?.length) prompt += `Atores/Atrizes: ${p1.actors.join(', ')}. `;
    if (p1.directors?.length) prompt += `Diretores: ${p1.directors.join(', ')}. `;
    if (p1.other) prompt += `Outras preferências: ${p1.other}. `;
  } else {
    const p1 = preferences.user1;
    const p2 = preferences.user2;
    prompt += "Somos um casal e queremos um filme que agrade a ambos. ";
    prompt += "Preferências da Pessoa 1: ";
    if (p1.genres?.length) prompt += `Gêneros: ${p1.genres.join(', ')}. `;
    if (p1.actors?.length) prompt += `Atores/Atrizes: ${p1.actors.join(', ')}. `;
    if (p1.directors?.length) prompt += `Diretores: ${p1.directors.join(', ')}. `;
    if (p1.other) prompt += `Outras preferências: ${p1.other}. `;
    prompt += "Preferências da Pessoa 2: ";
    if (p2.genres?.length) prompt += `Gêneros: ${p2.genres.join(', ')}. `;
    if (p2.actors?.length) prompt += `Atores/Atrizes: ${p2.actors.join(', ')}. `;
    if (p2.directors?.length) prompt += `Diretores: ${p2.directors.join(', ')}. `;
    if (p2.other) prompt += `Outras preferências: ${p2.other}. `;
    prompt += "Encontre filmes que equilibrem esses gostos.";
  }

  prompt += "\n\nRetorne APENAS JSON válido (application/json), exatamente neste formato: \n" +
    "{\n  \"movies\": [\n    { \"title\": \"Nome do Filme\" },\n    { \"title\": \"Outro Filme\" }\n  ]\n}\n" +
    "Regras: cada item DEVE conter o campo 'title' (string). O campo 'year' é OPCIONAL; inclua somente se tiver certeza.";
  return prompt;
}

exports.getRecommendations = async (req, res) => {
  try {
    const { mode, preferences } = req.body;
    const prompt = buildPrompt({ mode, preferences });

    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const result = response.data;
    let jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao processar resposta da IA', details: jsonText });
    }

    if (parsedJson.movies && parsedJson.movies.length > 0) {
      // Para cada título recomendado, buscar no TMDB e retornar no mesmo formato dos detalhes usados na Home
      const enrichedMovies = await Promise.all(parsedJson.movies.map(async (movie) => {
        try {
          // 1) Buscar por título (não limitar por ano); usaremos popularidade para escolher
          const tmdbSearch = await searchMovies(movie.title);
          const candidates = Array.isArray(tmdbSearch?.results) ? tmdbSearch.results : [];
          if (!candidates.length) return null;

          // 1.1) Se tiver ano, tente priorizar resultados do mesmo ano (+-1)
          let filtered = candidates;
          if (movie.year) {
            filtered = candidates.filter(r => {
              if (!r.release_date) return false;
              const y = parseInt(String(r.release_date).slice(0, 4), 10);
              return Number.isFinite(y) && Math.abs(y - Number(movie.year)) <= 1;
            });
            if (!filtered.length) filtered = candidates; // fallback
          }

          // 1.2) Ordenar por popularidade desc e escolher o mais popular
          filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          const tmdbMovie = filtered[0];
          if (!tmdbMovie) return null;

          // 2) Buscar detalhes completos (mesmo formato do endpoint /movies/details/:id)
          const details = await fetchMoviesDetailsById(tmdbMovie.id);

          // 3) Buscar plataformas de streaming (mesmo formato do endpoint /movies/streaming/:id)
          const streamingResp = await fetchStreamingOptions(tmdbMovie.id);
          const streamingBR = streamingResp?.results?.BR || streamingResp?.results?.US || {};

          // 4) Retornar no formato padrão TMDB + streaming, para reutilizar o frontend existente
          return {
            id: details?.id,
            title: details?.title,
            overview: details?.overview,
            genres: details?.genres,
            poster_path: details?.poster_path,
            release_date: details?.release_date,
            vote_average: details?.vote_average,
            runtime: details?.runtime,
            streaming: streamingBR,

          };
        } catch (err) {
          return null;
        }
      }));

      // Remover nulos (não encontrados) e retornar
      const movies = enrichedMovies.filter(Boolean);
      if (!movies.length) {
        return res.status(404).json({ error: 'Nenhuma recomendação encontrada na TMDB.' });
      }
      return res.status(200).json({ movies });
    } else {
      return res.status(404).json({ error: 'Nenhuma recomendação encontrada.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
