import Joi from 'joi';

const channelSchema = Joi.object({
  type: Joi.string().min(1).required(),
  recipient: Joi.string().min(1).required()
});

const escalationLevelSchema = Joi.object({
  delayMs: Joi.number().integer().min(0).default(0),
  channels: Joi.array().items(channelSchema).min(1).required()
});

export const createAlertSchema = Joi.object({
  source: Joi.string().min(1).default('manual'),
  deviceId: Joi.number().integer().positive().allow(null).default(null),
  ruleId: Joi.number().integer().positive().allow(null).default(null),
  severity: Joi.string().valid('info', 'warning', 'critical').default('info'),
  title: Joi.string().min(1).required(),
  message: Joi.string().min(1).required(),
  templateId: Joi.number().integer().positive().allow(null).default(null),
  templateData: Joi.object().default({}),
  escalationPolicy: Joi.array().items(escalationLevelSchema).min(1).required()
});

export const createTemplateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  channel: Joi.string().min(1).allow(null),
  subjectTemplate: Joi.string().allow('', null),
  bodyTemplate: Joi.string().min(1).required()
});
