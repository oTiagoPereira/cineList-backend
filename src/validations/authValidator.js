const { body, validationResult } = require("express-validator");

// Regras de validação para o registro
const registerRules = () => {
  return [
    body("name")
      .notEmpty()
      .withMessage("Nome é obrigatório.")
      .isLength({ min: 2 })
      .withMessage("Nome deve ter pelo menos 2 caracteres."),
    body("email")
      .isEmail()
      .withMessage("Por favor, forneça um email válido.")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("A senha deve ter no mínimo 6 caracteres."),
  ];
};

const loginRules = () => {
  return [
    body("email").isEmail().withMessage("Por favor, forneça um email válido."),
    body("password").notEmpty().withMessage("A senha é obrigatória."),
  ];
};

const changePasswordRules = () => {
  return [
    body("currentPassword")
      .notEmpty()
      .withMessage("A senha atual é obrigatória."),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("A nova senha deve ter no mínimo 6 caracteres.")
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error("A nova senha deve ser diferente da senha atual.");
        }
        return true;
      }),
  ];
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  // Pega a primeira mensagem de erro para enviar de forma mais amigável
  const firstError = errors.array()[0];
  return res.status(400).json({
    message: firstError.msg,
    errors: errors.array().map((err) => ({ [err.path]: err.msg })),
  });
};

module.exports = {
  registerRules,
  loginRules,
  changePasswordRules,
  validate,
};
