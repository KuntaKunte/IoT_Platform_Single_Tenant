import Joi from 'joi';

export const siteSchema = Joi.object({
  name: Joi.string().min(1).required(),
  location: Joi.string().allow('', null)
});

export const assetSchema = Joi.object({
  siteId: Joi.number().integer().positive().required(),
  name: Joi.string().min(1).required()
});

export const deviceSchema = Joi.object({
  assetId: Joi.number().integer().positive().allow(null),
  name: Joi.string().min(1).required(),
  deviceType: Joi.string().min(1).required(),
  metadata: Joi.object().default({})
});

export const sensorSchema = Joi.object({
  deviceId: Joi.number().integer().positive().required(),
  name: Joi.string().min(1).required(),
  metric: Joi.string().min(1).required()
});

export const deviceTypeSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null)
});

export const deviceTemplateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  defaults: Joi.object().default({})
});

export const provisionSchema = Joi.object({
  templateId: Joi.string().min(1).required(),
  name: Joi.string().min(1).required()
});
