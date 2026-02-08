const axios = require("axios");
const { searchMovies, fetchMoviesDetailsById, fetchStreamingOptions } = require("../services/moviesService.js");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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

// Função auxiliar para limpar a string JSON (remove markdown code blocks e espaços extras)
function cleanJsonString(str) {
  if (!str) return "";
  // Remove marcadores de código markdown (```json ... ``` ou apenas ``` ... ```)
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "");
  return cleaned.trim();
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

    // Tenta limpar e parsear o JSON
    let parsedJson;
    try {
      const cleanedJsonText = cleanJsonString(jsonText);
      parsedJson = JSON.parse(cleanedJsonText);
    } catch (e) {
      console.error("Erro no parse do JSON da Gemini:", e, "Texto original:", jsonText);
      return res.status(500).json({
        error: 'O serviço gerou uma resposta inválida. Por favor, tente novamente.',
        details: 'Falha ao interpretar a resposta.'
      });
    }

    if (parsedJson?.movies && Array.isArray(parsedJson.movies) && parsedJson.movies.length > 0) {
      const enrichedMovies = await Promise.all(parsedJson.movies.map(async (movie) => {
        try {
          if (!movie.title) return null;

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
          console.error(`Erro ao enriquecer filme: ${movie.title}`, err.message);
          return null;
        }
      }));

      // Remover nulos (não encontrados) e retornar
      const movies = enrichedMovies.filter(Boolean);

      if (!movies.length) {
        return res.status(404).json({ error: 'Nenhuma das recomendações foi encontrada na nossa base de dados.' });
      }

      return res.status(200).json({ movies });
    } else {
      return res.status(404).json({ error: 'O serviço não encontrou recomendações com os critérios informados.' });
    }
  } catch (error) {
    console.error("Erro geral no endpoint de recomendação:", error.message);
    if (error.response) {
      console.error("Detalhes do erro da API (Status " + error.response.status + "):", JSON.stringify(error.response.data, null, 2));
    }

    // Tratamento de erros específicos do Axios/Gemini
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // O servidor respondeu com um status fora do range 2xx
        if (error.response.status === 429) {
           return res.status(429).json({ error: 'Muitas solicitações ao serviço. Aguarde um momento e tente novamente.' });
        }
        if (error.response.status >= 500) {
           return res.status(503).json({ error: 'O serviço está temporariamente indisponível.' });
        }
        return res.status(error.response.status).json({
          error: 'Erro ao comunicar com o serviço.',
          details: error.response.data
        });
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta
        return res.status(503).json({ error: 'Sem resposta do serviço. Verifique sua conexão.' });
      }
    }

    return res.status(500).json({ error: 'Ocorreu um erro interno ao processar sua solicitação.' });
  }
};
