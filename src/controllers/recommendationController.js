const axios = require("axios");
const { searchMovies, fetchMoviesDetailsById, fetchStreamingOptions } = require("../services/moviesService.js");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

function buildPrompt({ mode, preferences }) {
  let prompt = "Aja como um especialista em cinema. Quero que você me recomende 10 filmes. ";

  if (mode === 'single') {
    const p1 = preferences.user1;
    prompt += "As minhas preferências são: ";
    if (p1.genres?.length) prompt += `Gêneros: ${p1.genres.join(', ')}. `;
    if (p1.actors?.length) prompt += `Atores/Atrizes: ${p1.actors.join(', ')}. `;
    if (p1.directors?.length) prompt += `Diretores: ${p1.directors.join(', ')}. `;
    if (p1.other) prompt += `Outras preferências: ${p1.other}. `;
  } else {
    const p1 = preferences.user1;
    const p2 = preferences.user2;
    prompt += "Somos um casal e queremos encontrar um filme que agrade a ambos. ";
    prompt += "As preferências da Pessoa 1 são: ";
    if (p1.genres?.length) prompt += `Gêneros: ${p1.genres.join(', ')}. `;
    if (p1.actors?.length) prompt += `Atores/Atrizes: ${p1.actors.join(', ')}. `;
    if (p1.directors?.length) prompt += `Diretores: ${p1.directors.join(', ')}. `;
    if (p1.other) prompt += `Outras preferências: ${p1.other}. `;
    prompt += "As preferências da Pessoa 2 são: ";
    if (p2.genres?.length) prompt += `Gêneros: ${p2.genres.join(', ')}. `;
    if (p2.actors?.length) prompt += `Atores/Atrizes: ${p2.actors.join(', ')}. `;
    if (p2.directors?.length) prompt += `Diretores: ${p2.directors.join(', ')}. `;
    if (p2.other) prompt += `Outras preferências: ${p2.other}. `;
    prompt += "Encontre filmes que combinem ou equilibrem esses dois gostos.";
  }

  prompt += "Retorne a resposta EXATAMENTE no seguinte formato JSON, sem nenhum texto adicional antes ou depois: ";
  prompt += "{\"movies\": [{\"title\": \"nome do filme\", \"year\": ano, \"synopsis\": \"uma sinopse curta\", \"posterUrl\": \"URL para um pôster de alta qualidade\", \"platform\": \"nome da plataforma onde tem o filme disponível\"}, ...restante dos filmes]}";
  prompt += "Não inclua filmes com URLs de pôster quebradas ou de baixa qualidade.";
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
      // Buscar dados reais na TMDB para cada filme recomendado
      const enrichedMovies = await Promise.all(parsedJson.movies.map(async (movie) => {
        try {
          // Busca por título e ano
          const tmdbResult = await searchMovies(`${movie.title} ${movie.year || ''}`);
          const tmdbMovie = tmdbResult && tmdbResult.results && tmdbResult.results.length > 0 ? tmdbResult.results[0] : null;
          if (!tmdbMovie) return { ...movie, tmdb: null };

          // Buscar detalhes completos
          const details = await fetchMoviesDetailsById(tmdbMovie.id);
          // Buscar plataformas de streaming
          const streaming = await fetchStreamingOptions(tmdbMovie.id);

          return {
            ...movie,
            tmdbId: tmdbMovie.id,
            overview: details?.overview,
            genres: details?.genres,
            posterUrl: details?.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : movie.posterUrl,
            releaseDate: details?.release_date,
            voteAverage: details?.vote_average,
            streaming: streaming?.results?.BR || {},
          };
        } catch (err) {
          return { ...movie, tmdb: null };
        }
      }));
      return res.status(200).json({ movies: enrichedMovies });
    } else {
      return res.status(404).json({ error: 'Nenhuma recomendação encontrada.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
