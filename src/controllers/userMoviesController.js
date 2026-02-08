const { PrismaClient } = require("@prisma/client");
const { fetchMoviesDetailsById } = require("../services/moviesService");
const prisma = new PrismaClient();

exports.listUserMovies = async (req, res) => {
  try {
    const user = req.user;

    const movies = await prisma.userMovie.findMany({
      where: { userId: user.id },
    });

    if (!movies) {
      // Retornar array vazio caso não haja filmes é mais apropriado que erro 500, mas mantendo a lógica de negócio se desejada.
      // Se "Sem filmes salvos" for um erro:
      return res.status(500).json({ message: "Sua lista de filmes está vazia ou inacessível." });
    }
    res.status(200).json(movies);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Não foi possível carregar os filmes.", details: error.message });
  }
};

exports.favoriteMovie = async (req, res) => {
  try {
    const user = req.user;
    const { movieId } = req.body;

    if (!movieId) {
      return res.status(400).json({ message: 'O identificador do filme é obrigatório.' });
    }
    const movieTmdbId = Number(movieId);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: 'Identificador do filme inválido.' });
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
      return res.status(200).json({ message: 'Este filme já está na sua lista.', saved: true, duplicate: true });
    }

    await prisma.userMovie.create({
      data: { userId, movieTmdbId }
    });

    return res.status(201).json({ message: 'Filme adicionado à sua lista!', saved: true });
  } catch (error) {
    if (error.code === 'P2002') { // unique constraint
      return res.status(200).json({ message: 'Este filme já está na sua lista.', saved: true, duplicate: true });
    }
    console.error('Erro ao salvar filme:', error);
    return res.status(500).json({ message: 'Não foi possível salvar o filme.', details: error.message });
  }
};

exports.deleteMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "Identificador do filme inválido." });
    }

    const movie = await prisma.userMovie.delete({
      where: {
        userId_movieTmdbId: {
          userId: userId,
          movieTmdbId: movieTmdbId,
        },
      },
    });

    res.status(200).json({ message: "Filme removido da sua lista.", movie });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Filme não encontrado na sua lista." });
    }

    console.error(error);
    res
      .status(500)
      .json({ message: "Não foi possível remover o filme.", details: error.message });
  }
};

exports.toggleWatched = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "Identificador do filme inválido." });
    }

    const existing = await prisma.userMovie.findUnique({
      where: { userId_movieTmdbId: { userId, movieTmdbId } }
    });
    if (!existing) {
      return res.status(404).json({ message: "Filme não encontrado na sua lista para atualizar." });
    }

    const updated = await prisma.userMovie.update({
      where: { userId_movieTmdbId: { userId, movieTmdbId } },
      data: { watched: !existing.watched }
    });

    return res.status(200).json({
      message: updated.watched ? 'Filme marcado como assistido.' : 'Filme marcado como não assistido.',
      saved: true,
      watched: updated.watched
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Erro ao atualizar status do filme.', details: error.message });
  }
};

exports.movieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const movieTmdbId = Number(id);
    if (isNaN(movieTmdbId)) {
      return res.status(400).json({ message: "Identificador do filme inválido." });
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
      .json({ message: "Erro ao verificar status do filme.", details: error.message });
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
      .json({ message: "Não foi possível carregar os detalhes dos seus filmes.", details: error.message });
  }
};
