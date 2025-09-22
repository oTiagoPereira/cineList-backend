import { body, validationResult } from 'express-validator';

// Regras de validação para o registro
export const registerRules = () => {
    return [
        // O email deve ser um email válido
        body('email')
            .isEmail()
            .withMessage('Por favor, forneça um email válido.')
            .normalizeEmail(), // Sanitização: remove pontos ou extensões do gmail, etc.

        // A senha deve ter no mínimo 6 caracteres
        body('password')
            .isLength({ min: 6 })
            .withMessage('A senha deve ter no mínimo 6 caracteres.'),
    ];
};

// Regras de validação para o login
export const loginRules = () => {
    return [
        body('email')
            .isEmail()
            .withMessage('Por favor, forneça um email válido.'),
        body('password')
            .notEmpty()
            .withMessage('A senha é obrigatória.'),
    ];
};

// Middleware que processa os erros de validação
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next(); // Se não houver erros, continua para o próximo middleware (o controller)
    }

    // Se houver erros, extrai as mensagens e envia como resposta
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

    return res.status(422).json({
        errors: extractedErrors,
    });
};
