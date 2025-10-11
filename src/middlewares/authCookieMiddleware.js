const jwt = require('jsonwebtoken');

const authCookieMiddleware = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ message: 'Não autenticado: token não encontrado.' });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decodedToken.userId,
      email: decodedToken.email,
      name: decodedToken.name
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = authCookieMiddleware;
