const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendPasswordResetEmail } = require('../config/mailer');

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
    return res.status(500).json({ error: 'Erro interno', message: error.message });
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
      id: user.id,
      email: user.email,
      name: user.name
    }, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Remover senha dos dados do usuário antes de enviar
    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    res.status(200).json({
      token: token,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno', message: error.message });
  }
};

// Controller para o callback do Google
exports.googleCallback = (req, res) => {
  if (!req.user) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }

  const user = req.user;
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    name: user.name
  }, process.env.JWT_SECRET, { expiresIn: "1d" });

  // Redireciona para o frontend com o token na URL
  res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}`);
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
    const userId = req.user.id;

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
  // O middleware de autenticação já validou o token e anexou os dados do usuário a req.user
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  // Retorna os dados do usuário obtidos do token
  return res.json({ user: req.user });
};

exports.logout = (req, res) => {
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
