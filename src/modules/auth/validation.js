import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const apiKeySchema = Joi.object({
  name: Joi.string().min(3).required(),
  roles: Joi.array().items(Joi.string()).default(['viewer'])
});

export const passwordResetSchema = Joi.object({
  email: Joi.string().email().required()
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});
