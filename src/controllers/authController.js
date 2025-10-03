const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

// Função auxiliar para limpar URLs
const cleanUrl = (baseUrl, path) => {
  const cleanBase = baseUrl.replace(/\/+$/, ''); // Remove barras no final
  const cleanPath = path.replace(/^\/+/, ''); // Remove barras no início
  return `${cleanBase}/${cleanPath}`;
};

exports.register = async (req, res) => {
  try {

    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email: email } });
    if (existingUser) {
      return res.status(409).json({ message: "Usuario ja cadastrado" });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const data = {
      name: name,
      email: email,
      password: hashedPassword,
    }

    const newUser = await prisma.user.create({ data });
    delete newUser.password

    res.status(201).json({ message: "Usuario cadastrado com sucesso", newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    }, process.env.JWT_SECRET, {
      expiresIn: "1d", // Aumentei para 1 dia para consistência
    });

    // Remover senha dos dados do usuário antes de enviar
    const userWithoutPassword = {
      id: user.id,
      name: user.name,
      email: user.email,
      googleId: user.googleId
    };

    // Definir cookies seguros
    const cookieOptions = {
      httpOnly: false, // Precisa ser false para permitir leitura no frontend
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    };

    // Definir cookie do token
    res.cookie('auth_token', token, cookieOptions);

    // Definir cookie dos dados do usuário
    res.cookie('user_data', JSON.stringify(userWithoutPassword), cookieOptions);

    // Definir cookie do user_id para fácil acesso
    res.cookie('user_id', user.id.toString(), cookieOptions);

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
    // Verificar se o usuário foi autenticado
    if (!req.user) {
      console.log('Usuário não autenticado no callback do Google');
      return res.redirect(cleanUrl(process.env.CLIENT_URL, 'login?error=authentication_failed'));
    }

    // Usuário autenticado com sucesso! `req.user` contém os dados do banco.
    console.log('Usuário autenticado com sucesso:', req.user.email);

    // Crie o token JWT (padronizado com o login normal)
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
    const cookieOptions = {
      httpOnly: false, // Precisa ser false para permitir leitura no frontend
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    };

    // Definir cookie do token
    res.cookie('auth_token', token, cookieOptions);

    // Definir cookie dos dados do usuário
    res.cookie('user_data', JSON.stringify(userWithoutPassword), cookieOptions);

    // Definir cookie do user_id para fácil acesso
    res.cookie('user_id', req.user.id.toString(), cookieOptions);

    // Redirecione de volta para o frontend
    res.redirect(cleanUrl(process.env.CLIENT_URL, `auth/success`));
  } catch (error) {
    console.error('Erro no callback do Google:', error);
    res.redirect(cleanUrl(process.env.CLIENT_URL, 'login?error=callback_error'));
  }
};

exports.googleLoginFailed = (req, res) => {
  console.log('Falha na autenticação Google OAuth');
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
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Token inválido" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none"
  });
  res.json({ message: "Logout realizado com sucesso" });
};
