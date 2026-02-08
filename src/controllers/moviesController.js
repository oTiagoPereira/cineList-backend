const {
  fetchPopularMovies,
  fetchMoviesDetailsById,
  fetchStreamingOptions,
  fetchMoviesSimilar,
  fetchGenres,
  fetchTopRated,
  searchMovies,
  fetchMoviesByGenre,
} = require("../services/moviesService");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getMoviesPopulares = async (req, res) => {
  try {
    const { page } = req.query;
    const movies = await fetchPopularMovies(page);
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Não foi possível carregar a lista de filmes populares.",
      details: error.message,
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
      message: "Não foi possível carregar os detalhes do filme.",
      details: error.message,
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
      message: "Não foi possível carregar as opções de streaming.",
      details: error.message,
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
      message: "Não foi possível encontrar filmes similares.",
      details: error.message,
    });
  }
};

exports.getGenres = async (req, res) => {
  try {
    const genres = await fetchGenres();
    res.status(200).json(genres);
  } catch (error) {
    console.error("Erro ao buscar gêneros:", error);
    res.status(500).json({
      message: "Não foi possível carregar a lista de gêneros.",
      details: error.message
    });
  }
};

exports.getTopRated = async (req, res) => {
  try {
    const { page } = req.query;
    const movies = await fetchTopRated(page);
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Não foi possível carregar os filmes mais avaliados.",
      details: error.message,
    });
  }
};

exports.getMoviesByGenre = async (req, res) => {
  try {
    const { id } = req.params;
    const { page } = req.query;
    const movies = await fetchMoviesByGenre(id, page);
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({
      message: "Não foi possível carregar filmes deste gênero.",
      details: error.message,
    });
  }
};

exports.getSearchMovies = async (req, res) => {
  try {
    const { query } = req.params;

    if (!query || !query.trim()) {
      return res
        .status(400)
        .json({ message: "Por favor, digite algo para pesquisar." });
    }

    const movies = await searchMovies(query);

    if (!movies) {
      return res
        .status(502)
        .json({ message: "O serviço de busca está indisponível no momento." });
    }

    return res.status(200).json({
      results: movies.results ?? [],
    });
  } catch (error) {
    console.error("Erro getSearchMovies:", error);
    res.status(500).json({
      message: "Não foi possível completar sua busca.",
      details: error.message,
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
      return res.status(500).json({ message: "Falha ao registrar o filme no sistema." });
    }

    res.status(200).json({ message: "Filme registrado com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Não foi possível registrar o filme.", details: error.message });
  }
};

exports.getSavedMovies = async (req, res) => {
  try {
    const movies = await prisma.movie.findMany();
    res.status(200).json(movies);
  } catch (error) {
    res.status(500).json({ message: "Não foi possível listar os filmes salvos.", details: error.message });
  }
};
