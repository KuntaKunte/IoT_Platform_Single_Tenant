import Joi from 'joi';

const positionSchema = Joi.object({
  x: Joi.number().integer().min(0).required(),
  y: Joi.number().integer().min(0).required(),
  w: Joi.number().integer().min(1).required(),
  h: Joi.number().integer().min(1).required()
});

const widgetSchema = Joi.object({
  id: Joi.string().min(1).required(),
  type: Joi.string().min(1).required(),
  title: Joi.string().min(1).required(),
  position: positionSchema.required(),
  config: Joi.object().required()
});

export const createDashboardSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
  layout: Joi.array().items(widgetSchema).default([])
});

export const updateDashboardSchema = createDashboardSchema;

export const createTemplateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
  layout: Joi.array().items(widgetSchema).default([])
});

export const instantiateTemplateSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null)
});
