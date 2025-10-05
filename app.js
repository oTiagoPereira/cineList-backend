require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const connectDB = require('./src/config/database');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');

const authRoutes = require('./src/routes/authRoute');
const moviesRoutes = require('./src/routes/moviesRoute');
const userMoviesRoutes = require('./src/routes/userMoviesRoute');
const recommendationRoutes = require('./src/routes/recommendationRoute');
require('./src/config/passport');

const app = express();

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());


app.use('/api/auth', authRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/user', userMoviesRoutes);
app.use('/api/recommendation', recommendationRoutes);

// Swagger docs
try {
  const openapiDocument = yaml.load(fs.readFileSync('./docs/openapi.yaml', 'utf8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
  console.log('Swagger docs disponíveis em /api/docs');
} catch (e) {
  console.error('Falha ao carregar OpenAPI:', e.message);
}


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
