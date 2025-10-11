const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authCookieMiddleware = require("../middlewares/authCookieMiddleware");

const {
  validate,
  registerRules,
  loginRules,
  changePasswordRules,
} = require("../validations/authValidator");

const passport = require("passport");

router.post("/register", registerRules(), validate, authController.register);
router.post("/login", loginRules(), validate, authController.login);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  authController.googleCallback
);

router.post("/change-password", authCookieMiddleware, changePasswordRules(), validate, authController.changePassword);

router.get("/me", authCookieMiddleware, authController.getMe);

router.post("/logout", authController.logout);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);


module.exports = router;
