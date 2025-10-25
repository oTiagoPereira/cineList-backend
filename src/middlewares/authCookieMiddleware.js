const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // Extrai o token do cabeçalho Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Não autenticado: token não encontrado." });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' do início

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Anexa os dados do usuário à requisição
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};
