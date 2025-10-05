const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  // Fallback cookie httpOnly
  if (!token && req.cookies?.auth_token) {
    token = req.cookies.auth_token;
  }
  if (!token) {
    return res.status(401).json({ message: 'Não autenticado' });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decodedToken.userId || decodedToken.id, id: decodedToken.userId || decodedToken.id };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};
