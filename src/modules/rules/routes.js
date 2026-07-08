import express from 'express';
import {
  createRule,
  getRule,
  listRules,
  updateRule,
  getRuleVersions,
  getRuleHistory,
  testRule
} from './services/rule-service.js';
import { authenticate, requirePermission } from '../auth/middleware.js';

const router = express.Router();
const manageRules = [authenticate, requirePermission('manage_rules')];
const readOnly = [authenticate, requirePermission('read')];

function parseRuleIdParam(req, res) {
  const ruleId = Number(req.params.ruleId);
  if (!Number.isInteger(ruleId) || ruleId <= 0) {
    res.status(400).json({ error: 'ruleId must be a positive integer' });
    return null;
  }
  return ruleId;
}

router.post('/', manageRules, async (req, res, next) => {
  try {
    const rule = await createRule(req.body);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

router.get('/', readOnly, async (_req, res, next) => {
  try {
    const rules = await listRules();
    res.status(200).json({ rules });
  } catch (err) {
    next(err);
  }
});

router.get('/:ruleId', readOnly, async (req, res, next) => {
  try {
    const ruleId = parseRuleIdParam(req, res);
    if (ruleId === null) return;

    const rule = await getRule(ruleId);
    res.status(200).json({ rule });
  } catch (err) {
    next(err);
  }
});

router.put('/:ruleId', manageRules, async (req, res, next) => {
  try {
    const ruleId = parseRuleIdParam(req, res);
    if (ruleId === null) return;

    const rule = await updateRule(ruleId, req.body);
    res.status(200).json({ rule });
  } catch (err) {
    next(err);
  }
});

router.get('/:ruleId/versions', readOnly, async (req, res, next) => {
  try {
    const ruleId = parseRuleIdParam(req, res);
    if (ruleId === null) return;

    const versions = await getRuleVersions(ruleId);
    res.status(200).json({ versions });
  } catch (err) {
    next(err);
  }
});

router.get('/:ruleId/history', readOnly, async (req, res, next) => {
  try {
    const ruleId = parseRuleIdParam(req, res);
    if (ruleId === null) return;

    const history = await getRuleHistory(ruleId);
    res.status(200).json({ history });
  } catch (err) {
    next(err);
  }
});

router.post('/:ruleId/test', manageRules, async (req, res, next) => {
  try {
    const ruleId = parseRuleIdParam(req, res);
    if (ruleId === null) return;

    const result = await testRule(ruleId, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
