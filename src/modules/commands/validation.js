import Joi from 'joi';

export const createCommandSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  type: Joi.string().min(1).required(),
  payload: Joi.object().default({}),
  scheduledAt: Joi.date().iso(),
  maxAttempts: Joi.number().integer().positive()
});

export const ackSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  status: Joi.string().valid('success', 'failure').required(),
  response: Joi.object().default({})
});
