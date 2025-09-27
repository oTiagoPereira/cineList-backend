const jwt = require('jsonwebtoken');

const authCookieMiddleware = (req, res, next) => {
  try {
    // Obter token dos cookies (usando o mesmo nome que o frontend)
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({
        message: 'Token de autenticação não encontrado. Faça login novamente.'
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adicionar informações do usuário ao request
    req.user = {
      id: decoded.userId || decoded.id, // Usar userId como id principal
      userId: decoded.userId || decoded.id, // compatibilidade
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    console.error('Erro na autenticação por cookie:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido. Faça login novamente.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado. Faça login novamente.'
      });
    }

    return res.status(401).json({
      message: 'Erro de autenticação. Faça login novamente.'
    });
  }
};

module.exports = authCookieMiddleware;
