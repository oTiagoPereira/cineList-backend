const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/userMoviesController");

router.post("/movies", auth,  ctrl.favoriteMovie);
router.get("/movies", auth, ctrl.listUserMovies);
router.get("/movies/details", auth, ctrl.listUserMoviesDetails);
router.delete("/movies/:id", auth, ctrl.deleteMovie);
router.patch("/movies/:id", auth, ctrl.toggleWatched);
router.get("/movies/:id/status", auth, ctrl.movieStatus);


module.exports = router;
