import Joi from 'joi';

// Both fields become path segments in the MinIO storage key
// (firmware/{deviceType}/{version}/...) — restrict to safe characters so upload
// input can't manipulate the resulting object key (e.g. "../" segments).
const safePathSegment = Joi.string()
  .pattern(/^(?!.*\.\.)[a-zA-Z0-9._-]+$/)
  .min(1)
  .required();

export const uploadFirmwareSchema = Joi.object({
  deviceType: safePathSegment,
  version: safePathSegment,
  description: Joi.string().allow('', null)
});

export const deployFirmwareSchema = Joi.object({
  firmwareId: Joi.number().integer().positive().required()
});

export const configSchema = Joi.object({
  config: Joi.object().required()
});
