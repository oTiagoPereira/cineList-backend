const express = require("express");
const router = express.Router();
const { getMoviesPopulares, getMoviesDetailsById, getStreamingOptions, getMoviesSimilar, getGenres, getTopRated, getSearchMovies, saveMovie } = require("../controllers/moviesController");

router.get("/populares", getMoviesPopulares);
router.get("/details/:id", getMoviesDetailsById);
router.get("/streaming/:id", getStreamingOptions);
router.get("/similar/:id", getMoviesSimilar);
router.get('/genres', getGenres);
router.get('/top-rated', getTopRated);
router.get('/search/:query', getSearchMovies);
module.exports = router;
