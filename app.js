require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/database');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');

const passport = require('./src/config/passport');

const authRoutes = require('./src/routes/authRoute');
const moviesRoutes = require('./src/routes/moviesRoute');
const userMoviesRoutes = require('./src/routes/userMoviesRoute');
const recommendationRoutes = require('./src/routes/recommendationRoute');

const app = express();

connectDB();

app.use(passport.initialize());

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = ['http://localhost:3030', 'https://cinelistweb.vercel.app'];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

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
