import Joi from 'joi';

const conditionSchema = Joi.object({
  field: Joi.string().min(1).required(),
  operator: Joi.string().valid('gt', 'gte', 'lt', 'lte', 'eq', 'neq').required(),
  value: Joi.alternatives(Joi.number(), Joi.string(), Joi.boolean()).required()
});

const actionSchema = Joi.object({
  type: Joi.string().min(1).required(),
  config: Joi.object().required()
});

export const createRuleSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
  enabled: Joi.boolean().default(true),
  deviceId: Joi.number().integer().positive().allow(null).default(null),
  conditionLogic: Joi.string().valid('all', 'any').default('all'),
  conditions: Joi.array().items(conditionSchema).min(1).required(),
  actions: Joi.array().items(actionSchema).min(1).required()
});

export const updateRuleSchema = createRuleSchema;

export const testRuleSchema = Joi.object({
  payload: Joi.object().required()
});
