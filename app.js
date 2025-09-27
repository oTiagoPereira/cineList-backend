require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const connectDB = require('./src/config/database');

const authRoutes = require('./src/routes/authRoute');
const moviesRoutes = require('./src/routes/moviesRoute');
const userMoviesRoutes = require('./src/routes/userMoviesRoute');
const recommendationRoutes = require('./src/routes/recommendationRoute');
require('./src/config/passport');

const app = express();

connectDB();

app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    process.env.CLIENT_URL + '/',
    'http://localhost:3030',
    'http://localhost:3030/'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());


app.use('/api/auth', authRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/user', userMoviesRoutes);
app.use('/api/recommendation', recommendationRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
