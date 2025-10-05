const { body, validationResult } = require('express-validator');

// Regras de validação para o registro
const registerRules = () => {
    return [
        body('name')
            .notEmpty()
            .withMessage('Nome é obrigatório.')
            .isLength({ min: 2 })
            .withMessage('Nome deve ter pelo menos 2 caracteres.'),
        body('email')
            .isEmail()
            .withMessage('Por favor, forneça um email válido.')
            .normalizeEmail(),
        body('password')
            .isLength({ min: 6 })
            .withMessage('A senha deve ter no mínimo 6 caracteres.'),
    ];
};

const loginRules = () => {
    return [
        body('email')
            .isEmail()
            .withMessage('Por favor, forneça um email válido.'),
        body('password')
            .notEmpty()
            .withMessage('A senha é obrigatória.'),
    ];
};

const changePasswordRules = () => {
    return [
        body('currentPassword')
            .notEmpty()
            .withMessage('A senha atual é obrigatória.'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('A nova senha deve ter no mínimo 6 caracteres.')
            .custom((value, { req }) => {
                if (value === req.body.currentPassword) {
                    throw new Error('A nova senha deve ser diferente da senha atual.');
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
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
    return res.status(422).json({
        errors: extractedErrors,
    });
};

module.exports = {
    registerRules,
    loginRules,
    changePasswordRules,
    validate
};
