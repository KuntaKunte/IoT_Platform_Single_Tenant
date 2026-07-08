export function getFieldValue(payload, field) {
  return field.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), payload);
}
