import Joi from 'joi';

export const manifestSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9-]*$/)
    .min(1)
    .required(),
  version: Joi.string().min(1).required(),
  description: Joi.string().allow('', null),
  main: Joi.string().min(1).default('index.js')
});

export function validateManifest(raw) {
  const { error, value } = manifestSchema.validate(raw);
  if (error) {
    throw new Error(error.details[0].message);
  }
  return value;
}
