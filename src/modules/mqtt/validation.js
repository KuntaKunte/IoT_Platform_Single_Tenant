import Joi from 'joi';

export const telemetrySchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  topic: Joi.string().min(1).required(),
  payload: Joi.object().min(1).required()
});

export const topicSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  topic: Joi.string().min(1).required()
});

export const heartbeatSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required()
});
