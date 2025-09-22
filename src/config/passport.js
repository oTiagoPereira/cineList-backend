const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const newUser = {
      googleId: profile.id,
      name: profile.name.givenName,
      email: profile.emails[0].value,
    };

    try {
      let user = await prisma.user.findOne({ email: profile.emails[0].value });

      if (user) {
        done(null, user);
      } else {
        user = await prisma.user.create(newUser);
        done(null, user);
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

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => done(err, user));
});