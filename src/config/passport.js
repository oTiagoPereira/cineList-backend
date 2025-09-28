const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Verificar se profile.emails existe e tem pelo menos um email
      if (!profile.emails || profile.emails.length === 0) {
        return done(new Error('Não foi possível obter o email da conta Google'), null);
      }

      const email = profile.emails[0].value;
      const googleId = profile.id;
      const name = profile.name?.givenName || profile.displayName || "Google User";

      // Primeiro, verifica se existe um usuário com este googleId
      let user = await prisma.user.findUnique({
        where: { googleId: googleId }
      });

      if (!user) {
        // Se não existe, verifica se existe um usuário com este email
        user = await prisma.user.findUnique({
          where: { email: email }
        });

        if (user) {
          // Se existe um usuário com o email mas sem googleId, atualiza
          user = await prisma.user.update({
            where: { email: email },
            data: { googleId: googleId }
          });
        }
      }

      if (user) {
        return done(null, user);
      } else {
        // Cria um novo usuário
        const newUser = await prisma.user.create({
          data: {
            googleId: googleId,
            name: name,
            email: email,
            password: "", // Google OAuth não precisa de senha
          }
        });
        return done(null, newUser);
      }
    } catch (err) {
      console.error('Erro no Google OAuth Strategy:', err);
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return done(new Error('Usuário não encontrado'), null);
    }
    done(null, user);
  } catch (err) {
    console.error('Erro no deserializeUser:', err);
    done(err, null);
  }
});
