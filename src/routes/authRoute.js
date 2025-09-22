const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const authController = require("../controllers/authController");
const {
  validate,
  registerRules,
  loginRules,
} = require("../validations/authValidator");
const passport = require("passport")

router.post("/register", registerRules(), validate, authController.register);
router.post("/login", loginRules(), validate, authController.login);
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Rota de callback -> O Google redireciona para cá
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
  (req, res) => {
    // Usuário autenticado com sucesso! `req.user` contém os dados do banco.

    // Crie o token JWT
    const token = jwt.sign(
        { id: req.user.id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' } // Token expira em 1 dia
    );

    // Redirecione de volta para o frontend, enviando o token como parâmetro de URL
    res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`);
  }
);

router.get('/login/failed', (req, res) => {
    res.status(401).json({ message: 'Falha na autenticação.'});
});

module.exports = router;
