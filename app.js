const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');

const authRoutes = require('./src/routes/authRoute');
const moviesRoutes = require('./src/routes/moviesRoute');
const userMoviesRoutes = require('./src/routes/userMoviesRoute');
const recommendationRoutes = require('./src/routes/recommendationRoute');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());


app.use('/api/auth', authRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/user', userMoviesRoutes);
app.use('/api/recommendation', recommendationRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
