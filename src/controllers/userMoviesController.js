const { PrismaClient } = require("../generated/prisma/index");
const { fetchMoviesDetailsById } = require("../services/moviesService");
const prisma = new PrismaClient();

exports.listUserMovies = async (req, res) => {
  try {
    const user = req.user;

    const movies = await prisma.userMovie.findMany({
      where: { userId: user.id },
    });

    if (!movies) {
      return res.status(500).json({ message: "Sem filmes salvos" });
    }
    res.status(200).json(movies);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message, message: "Erro ao buscar filmes" });
  }
};

exports.favoriteMovie = async (req, res) => {
  try {
    const user = req.user;
    const { movieId } = req.body;

    if (!movieId) {
      return res.status(400).json({ message: 'movieId é obrigatório' });
    }
    const movieTmdbId = Number(movieId);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: 'movieId inválido' });
    }

    const userId = user.id;

    const existing = await prisma.userMovie.findUnique({
      where: {
        userId_movieTmdbId: {
          userId: userId,
          movieTmdbId: movieTmdbId
        }
      }
    });
    if (existing) {
      return res.status(200).json({ message: 'Filme já estava salvo', saved: true, duplicate: true });
    }

    await prisma.userMovie.create({
      data: { userId, movieTmdbId }
    });

    return res.status(201).json({ message: 'Filme salvo com sucesso!', saved: true });
  } catch (error) {
    if (error.code === 'P2002') { // unique constraint
      return res.status(200).json({ message: 'Filme já estava salvo', saved: true, duplicate: true });
    }
    console.error('Erro ao salvar filme:', error);
    return res.status(500).json({ error: error.message, message: 'Erro ao salvar o filme' });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "movieId inválido" });
    }

    const movie = await prisma.userMovie.delete({
      where: {
        userId_movieTmdbId: {
          userId: userId,
          movieTmdbId: movieTmdbId,
        },
      },
    });

    res.status(200).json({ message: "Filme deletado com sucesso!", movie });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Filme não encontrado" });
    }

    console.error(error);
    res
      .status(500)
      .json({ error: error.message, message: "Erro ao deletar o filme" });
  }
};

exports.toggleWatched = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "movieId inválido" });
    }

    const existing = await prisma.userMovie.findUnique({
      where: { userId_movieTmdbId: { userId, movieTmdbId } }
    });
    if (!existing) {
      return res.status(404).json({ message: "Filme não encontrado" });
    }

    const updated = await prisma.userMovie.update({
      where: { userId_movieTmdbId: { userId, movieTmdbId } },
      data: { watched: !existing.watched }
    });

    return res.status(200).json({
      message: 'Status de watched atualizado',
      saved: true,
      watched: updated.watched
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message, message: 'Erro ao alterar o filme' });
  }
};

exports.movieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "movieId inválido" });
    }

    const movie = await prisma.userMovie.findUnique({
      where: {
        userId_movieTmdbId: {
          userId: userId,
          movieTmdbId: movieTmdbId,
        },
      },
    });

    res.status(200).json({
      saved: !!movie,
      watched: movie ? !!movie.watched : false,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: error.message, message: "Erro ao buscar o filme" });
  }
};

exports.listUserMoviesDetails = async (req, res) => {
  try {
    const user = req.user;
    const movies = await prisma.userMovie.findMany({
      where: { userId: user.id },
    });

    if (!movies || movies.length === 0) {
      return res.status(200).json([]);
    }

    // Busca detalhes usando a função já existente
    const detailsPromises = movies.map(async (movie) => {
      const details = await fetchMoviesDetailsById(movie.movieTmdbId);
      if (!details) return null;
      return {
        ...details,
        saved: true,
        watched: movie.watched,
      };
    });

    const details = await Promise.all(detailsPromises);
    const validDetails = details.filter(Boolean);

    res.status(200).json(validDetails);
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message, message: "Erro ao buscar filmes salvos" });
  }
};
