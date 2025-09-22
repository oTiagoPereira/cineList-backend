const {
  fetchPopularMovies,
  fetchMoviesDetailsById,
  fetchStreamingOptions,
  fetchMoviesSimilar,
  fetchGenres,
  fetchTopRated,
  searchMovies,
} = require("../services/moviesService");
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

exports.getMoviesPopulares = async (req, res) => {
  try {
    const movies = await fetchPopularMovies();
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar filmes populares",
      error: error.message,
    });
  }
};

exports.getMoviesDetailsById = async (req, res) => {
  try {
    const { id } = req.params;
    const movie = await fetchMoviesDetailsById(id);
    res.status(200).json(movie);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar detalhes do filme",
      error: error.message,
    });
  }
};

exports.getStreamingOptions = async (req, res) => {
  try {
    const { id } = req.params;
    const streamingOptions = await fetchStreamingOptions(id);
    const streamingBR = streamingOptions.results.BR
      ? streamingOptions.results.BR
      : streamingOptions.results.US;
    res.status(200).json(streamingBR);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar opções de streaming",
      error: error.message,
    });
  }
};

exports.getMoviesSimilar = async (req, res) => {
  try {
    const { id } = req.params;
    const movies = await fetchMoviesSimilar(id);
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar filmes similares",
      error: error.message,
    });
  }
};

exports.getGenres = async (req, res) => {
  try {
    const genres = await fetchGenres(); // Você precisará criar essa função no seu serviço
    res.status(200).json(genres);
  } catch (error) {
    console.error("Erro ao buscar gêneros:", error);
    res.status(500).json({ message: "Ocorreu um erro interno no servidor." });
  }
};

exports.getTopRated = async (req, res) => {
  try {
    const movies = await fetchTopRated();
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar filmes mais avaliados",
      error: error.message,
    });
  }
};

exports.getSearchMovies = async (req, res) => {
  try {
    // A rota foi definida como /search/:query então usamos params
    const { query } = req.params;

    if (!query || !query.trim()) {
      return res
        .status(400)
        .json({ message: "Parâmetro 'query' é obrigatório." });
    }

    const movies = await searchMovies(query);

    if (!movies) {
      return res
        .status(502)
        .json({ message: "Não foi possível obter resultados no momento." });
    }

    return res.status(200).json({
      results: movies.results ?? [],
    });
  } catch (error) {
    console.error("Erro getSearchMovies:", error);
    res.status(500).json({
      message: "Erro ao buscar filmes",
      error: error.message,
    });
  }
};

exports.saveMovie = async (req, res) => {
  try {
    const { movie } = req.body;

    const data = {
      movieId: movie.id,
    };

    const newMovie = await prisma.movie.create({ data });

    if (!newMovie) {
      return res.status(500).json({ message: "Erro ao salvar filme" });
    }

    res.status(200).json({ message: "Filme salvo com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: error.message, message: "Erro ao salvar o filme" });
  }
};

exports.getSavedMovies = async (req, res) => {
  try {
    const movies = await prisma.movie.findMany();
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message, message: "Erro ao buscar filmes" });
  }
};
