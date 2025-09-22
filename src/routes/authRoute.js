const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validate,
  registerRules,
  loginRules,
} = require("../validations/authValidator");

router.post("/register", registerRules(), validate, authController.register);
router.post("/login", loginRules(), validate, authController.login);

module.exports = router;
