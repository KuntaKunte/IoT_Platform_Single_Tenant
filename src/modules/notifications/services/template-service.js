import { dbClient } from '../../../shared/database.js';
import { createTemplateSchema } from '../validation.js';
import { TemplateRepository } from '../repositories/template-repository.js';

const templateRepository = new TemplateRepository(dbClient);

export function renderTemplate(template, data) {
  if (!template) {
    return template;
  }
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), data);
    return value !== undefined ? String(value) : '';
  });
}

export async function createTemplate(input) {
  const { error, value } = createTemplateSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  return templateRepository.create({
    name: value.name,
    channel: value.channel,
    subject_template: value.subjectTemplate,
    body_template: value.bodyTemplate
  });
}

export async function getTemplate(id) {
  const template = await templateRepository.findById(id);
  if (!template) {
    throw Object.assign(new Error('Template not found'), { status: 404 });
  }
  return template;
}

export async function listTemplates() {
  return templateRepository.findAll();
}
