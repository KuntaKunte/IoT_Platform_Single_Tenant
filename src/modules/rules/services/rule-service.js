import { dbClient } from '../../../shared/database.js';
import { createLogger } from '../../../shared/logger.js';
import { getFieldValue } from '../../../shared/object-path.js';
import { deviceExists } from '../../devices/services/device-service.js';
import { createRuleSchema, updateRuleSchema, testRuleSchema } from '../validation.js';
import { executeAction } from '../actions/index.js';
import { RuleRepository } from '../repositories/rule-repository.js';

const logger = createLogger();
const ruleRepository = new RuleRepository(dbClient);

function evaluateCondition(payload, condition) {
  const actual = getFieldValue(payload, condition.field);
  switch (condition.operator) {
    case 'gt':
      return actual > condition.value;
    case 'gte':
      return actual >= condition.value;
    case 'lt':
      return actual < condition.value;
    case 'lte':
      return actual <= condition.value;
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    default:
      return false;
  }
}

function evaluateConditions(payload, conditions, logic) {
  const results = conditions.map((condition) => ({
    ...condition,
    actual: getFieldValue(payload, condition.field),
    passed: evaluateCondition(payload, condition)
  }));
  const matched = logic === 'any' ? results.some((result) => result.passed) : results.every((result) => result.passed);
  return { matched, results };
}

async function validateRuleInput(schema, input) {
  const { error, value } = schema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  if (value.deviceId != null && !(await deviceExists(value.deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  return value;
}

export async function createRule(input) {
  const value = await validateRuleInput(createRuleSchema, input);
  return ruleRepository.create(value);
}

export async function getRule(id) {
  const rule = await ruleRepository.findById(id);
  if (!rule) {
    throw Object.assign(new Error('Rule not found'), { status: 404 });
  }
  return rule;
}

export async function listRules() {
  return ruleRepository.findAll();
}

export async function updateRule(id, input) {
  const value = await validateRuleInput(updateRuleSchema, input);
  const existing = await getRule(id);

  await ruleRepository.snapshotVersion(existing);
  return ruleRepository.update(id, value);
}

export async function getRuleVersions(id) {
  await getRule(id);
  return ruleRepository.findVersions(id);
}

export async function getRuleHistory(id, { limit = 50 } = {}) {
  await getRule(id);
  return ruleRepository.findHistory(id, { limit });
}

export async function testRule(id, input) {
  const { error, value } = testRuleSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  const rule = await getRule(id);
  const { matched, results } = evaluateConditions(value.payload, rule.conditions, rule.condition_logic);

  return {
    matched,
    conditionResults: results,
    actionsThatWouldRun: matched ? rule.actions : []
  };
}

export async function evaluateRulesForTelemetry({ deviceId, payload }) {
  const rules = await ruleRepository.findActiveForDevice(deviceId);

  for (const rule of rules) {
    const { matched } = evaluateConditions(payload, rule.conditions, rule.condition_logic);
    if (!matched) {
      continue;
    }

    const actionsResult = [];
    for (const action of rule.actions) {
      try {
        const result = await executeAction(action, { deviceId, payload });
        actionsResult.push({ type: action.type, success: true, result });
      } catch (err) {
        logger.error({ err, ruleId: rule.id, action }, 'Rule action execution failed');
        actionsResult.push({ type: action.type, success: false, error: err.message });
      }
    }

    await ruleRepository.recordHistory(rule.id, deviceId, payload, actionsResult);
  }
}
