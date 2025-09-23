const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
      if (!user) {
        user = await prisma.user.findUnique({ where: { email: profile.emails[0].value } });
      }
      if (user) {
        done(null, user);
      } else {
        const newUser = await prisma.user.create({
          data: {
            googleId: profile.id,
            name: profile.name.givenName || profile.displayName || "Google User",
            email: profile.emails[0].value,
            password: "",
          }
        });
        done(null, newUser);
      }
    } catch (err) {
      console.error(err);
      done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
