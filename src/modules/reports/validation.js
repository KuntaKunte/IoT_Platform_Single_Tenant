import Joi from 'joi';

const metricSchema = Joi.object({
  field: Joi.string().min(1).required(),
  label: Joi.string().min(1).required(),
  aggregation: Joi.string().valid('avg', 'min', 'max', 'sum', 'count').required()
});

export const createReportSchema = Joi.object({
  name: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
  deviceIds: Joi.array().items(Joi.number().integer().positive()).default([]),
  metrics: Joi.array().items(metricSchema).min(1).required(),
  includeAlertSummary: Joi.boolean().default(true),
  includeCommandSummary: Joi.boolean().default(true),
  bucketInterval: Joi.string().valid('hour', 'day', 'week').default('day'),
  periodDays: Joi.number().integer().min(1).default(7)
});

export const updateReportSchema = createReportSchema;

export const createScheduleSchema = Joi.object({
  frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
  hourOfDay: Joi.number().integer().min(0).max(23).default(8),
  dayOfWeek: Joi.number()
    .integer()
    .min(0)
    .max(6)
    .when('frequency', { is: 'weekly', then: Joi.required(), otherwise: Joi.optional().allow(null) }),
  dayOfMonth: Joi.number()
    .integer()
    .min(1)
    .max(28)
    .when('frequency', { is: 'monthly', then: Joi.required(), otherwise: Joi.optional().allow(null) }),
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
  format: Joi.string().valid('pdf', 'excel').default('pdf'),
  active: Joi.boolean().default(true)
});

export const updateScheduleSchema = createScheduleSchema;
