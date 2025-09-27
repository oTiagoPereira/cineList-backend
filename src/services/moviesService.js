import axios from "axios";

const TMDB_API_AUTH = process.env.TMDB_API_AUTH;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const options = {
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${TMDB_API_AUTH}`,
  },
};

export const fetchPopularMovies = async () => {
  const url =
    "https://api.themoviedb.org/3/movie/popular?language=pt-BR&page=1";

  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const fetchMoviesDetailsById = async (id) => {
  const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=pt-BR`;
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const fetchStreamingOptions = async (id) => {
  const url = `https://api.themoviedb.org/3/movie/${id}/watch/providers?language=pt-BR`;
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const fetchMoviesSimilar = async (id) => {
  const url = `https://api.themoviedb.org/3/movie/${id}/similar?language=pt-BR&page=1`;
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const fetchGenres = async () => {
  const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=pt-BR`;
  try {
    const response = await axios.get(url);
    return response.data.genres;
  } catch (error) {
    console.error(error);
  }
};

export const fetchTopRated = async () => {
  const url = `https://api.themoviedb.org/3/movie/top_rated?language=pt-BR&page=1`;
  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const searchMovies = async (query) => {
  if (!query || query.trim() === "") {
    throw new Error("O parâmetro 'query' está vazio ou indefinido!");
  }

  const url = `https://api.themoviedb.org/3/search/movie?language=pt-BR&query=${encodeURIComponent(
    query
  )}`;

  try {
    const response = await axios.get(url, options);
    return response.data;
  } catch (error) {
    console.error("Erro na busca:", error.response?.data || error.message);
  }
};
