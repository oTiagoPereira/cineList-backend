const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();
const { sendPasswordResetEmail } = require('../config/mailer');

// Função auxiliar para limpar URLs
const cleanUrl = (baseUrl, path) => {
  const cleanBase = baseUrl.replace(/\/+$/, ''); // Remove barras no final
  const cleanPath = path.replace(/^\/+/, ''); // Remove barras no início
  return `${cleanBase}/${cleanPath}`;
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, email e senha são obrigatórios" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Usuário já cadastrado" });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword }
    });

    const userResponse = { id: newUser.id, name: newUser.name, email: newUser.email };

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso. Faça login para continuar.",
      user: userResponse
    });
  } catch (error) {
    console.error("Erro no registro:", error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email: email } });

    if (!user) {
      return res.status(401).json({ message: "Auth failed" });
    }

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      return res.status(401).json({ message: "Auth failed" });
    }

    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name
    }, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Remover senha dos dados do usuário antes de enviar
    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
      googleId: user.googleId
    };

    // Definir cookies seguros
    const baseCookieOptions = {
      httpOnly: true, // segurança: não acessível via JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    };

    res.cookie('auth_token', token, baseCookieOptions);

    const readableCookieOptions = { ...baseCookieOptions, httpOnly: false };
    res.cookie('user_data', JSON.stringify(userWithoutPassword), readableCookieOptions);
    res.cookie('user_id', user.id.toString(), readableCookieOptions);

    res.status(200).json({
      token,
      userId: user.id,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Google OAuth Controllers
exports.googleAuth = (req, res, next) => {
  // Esta função será executada pelo passport.authenticate
  // Não precisa de lógica aqui, o Passport cuida da autenticação
};

exports.googleCallback = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(cleanUrl(process.env.CLIENT_URL, 'login?error=authentication_failed'));
    }

    const token = jwt.sign(
      {
        userId: req.user.id,
        email: req.user.email,
        name: req.user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' } // Token expira em 1 dia
    );

    // Dados do usuário para os cookies
    const userWithoutPassword = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      googleId: req.user.googleId
    };

    // Definir cookies seguros
    const baseCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    };
    const readableCookieOptions = { ...baseCookieOptions, httpOnly: false };

    res.cookie('auth_token', token, baseCookieOptions);
    res.cookie('user_data', JSON.stringify(userWithoutPassword), readableCookieOptions);
    res.cookie('user_id', req.user.id.toString(), readableCookieOptions);

    res.redirect(cleanUrl(process.env.CLIENT_URL, `auth/success`));
  } catch (error) {
    console.error('Erro no callback do Google:', error);
    res.redirect(cleanUrl(process.env.CLIENT_URL, 'login?error=callback_error'));
  }
};

exports.googleLoginFailed = (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Falha na autenticação com Google. Tente novamente.',
    error: 'google_auth_failed'
  });
};

// Alterar senha do usuário
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verificar se os campos obrigatórios foram fornecidos
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Senha atual e nova senha são obrigatórias"
      });
    }

    // Verificar se nova senha tem pelo menos 6 caracteres
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "A nova senha deve ter pelo menos 6 caracteres"
      });
    }

    // Obter ID do usuário do token JWT fornecido pelo middleware
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Token de autenticação necessário" });
    }

    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Verificar se a senha atual está correta
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Senha atual incorreta" });
    }

    // Verificar se a nova senha é diferente da atual
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "A nova senha deve ser diferente da senha atual"
      });
    }

    // Criptografar nova senha
    const salt = await bcrypt.genSalt(12);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Atualizar senha no banco
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.status(200).json({
      message: "Senha alterada com sucesso"
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      message: "Erro interno do servidor",
      error: error.message
    });
  }
};

exports.getMe = (req, res) => {
  // Prioriza cookie httpOnly
  let token = req.cookies?.auth_token;
  // Fallback para Authorization Bearer
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = { id: decoded.userId || decoded.id, email: decoded.email, name: decoded.name };
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

exports.logout = (req, res) => {
  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };
  res.clearCookie('auth_token', cookieBase);
  res.clearCookie('user_data', { ...cookieBase, httpOnly: false });
  res.clearCookie('user_id', { ...cookieBase, httpOnly: false });
  return res.json({ message: 'Logout realizado com sucesso' });
};

// Solicitar reset de senha
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Resposta genérica para evitar enumeração de usuários
    if (!user) {
      return res.status(200).json({ message: 'Se o email existir enviaremos instruções de reset' });
    }

    // Invalidar tokens antigos (opcional: marcar como usados). Aqui apenas deixamos expirar.

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const baseUrl = process.env.CLIENT_URL?.replace(/\/$/, '');
    const resetLink = `${baseUrl}/resetar-senha?token=${rawToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendPasswordResetEmail(email, resetLink);
    } catch (mailErr) {
      console.error('Falha ao enviar email de reset:', mailErr);
    }

    return res.status(200).json({
      message: 'Se o email existir enviaremos instruções de reset',
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });
  } catch (error) {
    console.error('Erro forgotPassword:', error);
    return res.status(500).json({ message: 'Erro interno', error: error.message });
  }
};

// Resetar senha com token
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.status(400).json({ message: 'Email, token e nova senha são obrigatórios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Senha deve ter ao menos 6 caracteres' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Token inválido ou expirado' });
    }

    // Buscar tokens não usados e não expirados
    const tokens = await prisma.passwordResetToken.findMany({
      where: {
        userId: user.id,
        used: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    let validToken = null;
    for (const t of tokens) {
      const match = await bcrypt.compare(token, t.tokenHash);
      if (match) {
        validToken = t;
        break;
      }
    }

    if (!validToken) {
      return res.status(400).json({ message: 'Token inválido ou expirado' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { id: validToken.id }, data: { used: true } })
    ]);

    return res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro resetPassword:', error);
    return res.status(500).json({ message: 'Erro interno', error: error.message });
  }
};
