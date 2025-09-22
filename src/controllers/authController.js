const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("../generated/prisma/index");
const prisma = new PrismaClient();

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

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ token, userId: user.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
