const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB Atlas com sucesso!');
  } catch (err) {
    console.error('Erro de conexão:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
