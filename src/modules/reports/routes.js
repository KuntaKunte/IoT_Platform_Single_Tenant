import express from 'express';
import {
  createReport,
  getReport,
  listReports,
  updateReport,
  deleteReport,
  getReportData,
  createSchedule,
  listSchedulesForReport,
  updateSchedule,
  deleteSchedule,
  listRuns
} from './services/report-service.js';
import { exportReportToPdf, exportReportToExcel } from './services/export-service.js';
import { authenticate, requirePermission } from '../auth/middleware.js';

const router = express.Router();
const manageReports = [authenticate, requirePermission('manage_reports')];
const readOnly = [authenticate, requirePermission('read')];

function parseIdParam(paramName, req, res) {
  const id = Number(req.params[paramName]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: `${paramName} must be a positive integer` });
    return null;
  }
  return id;
}

router.post('/', manageReports, async (req, res, next) => {
  try {
    const report = await createReport(req.body);
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

router.get('/', readOnly, async (_req, res, next) => {
  try {
    const reports = await listReports();
    res.status(200).json({ reports });
  } catch (err) {
    next(err);
  }
});

router.get('/:reportId', readOnly, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const report = await getReport(reportId);
    res.status(200).json({ report });
  } catch (err) {
    next(err);
  }
});

router.put('/:reportId', manageReports, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const report = await updateReport(reportId, req.body);
    res.status(200).json({ report });
  } catch (err) {
    next(err);
  }
});

router.delete('/:reportId', manageReports, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    await deleteReport(reportId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:reportId/data', readOnly, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const data = await getReportData(reportId, { from: req.query.from, to: req.query.to });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:reportId/export', readOnly, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const format = req.query.format === 'excel' ? 'excel' : 'pdf';
    const report = await getReport(reportId);
    const data = await getReportData(reportId, { from: req.query.from, to: req.query.to });

    if (format === 'excel') {
      const buffer = await exportReportToExcel(report, data);
      res.status(200);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.xlsx"`);
      res.send(buffer);
    } else {
      const buffer = await exportReportToPdf(report, data);
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
      res.send(buffer);
    }
  } catch (err) {
    next(err);
  }
});

router.post('/:reportId/schedules', manageReports, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const schedule = await createSchedule(reportId, req.body);
    res.status(201).json({ schedule });
  } catch (err) {
    next(err);
  }
});

router.get('/:reportId/schedules', readOnly, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const schedules = await listSchedulesForReport(reportId);
    res.status(200).json({ schedules });
  } catch (err) {
    next(err);
  }
});

router.put('/:reportId/schedules/:scheduleId', manageReports, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;
    const scheduleId = parseIdParam('scheduleId', req, res);
    if (scheduleId === null) return;

    const schedule = await updateSchedule(reportId, scheduleId, req.body);
    res.status(200).json({ schedule });
  } catch (err) {
    next(err);
  }
});

router.delete('/:reportId/schedules/:scheduleId', manageReports, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;
    const scheduleId = parseIdParam('scheduleId', req, res);
    if (scheduleId === null) return;

    await deleteSchedule(reportId, scheduleId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:reportId/runs', readOnly, async (req, res, next) => {
  try {
    const reportId = parseIdParam('reportId', req, res);
    if (reportId === null) return;

    const runs = await listRuns(reportId);
    res.status(200).json({ runs });
  } catch (err) {
    next(err);
  }
});

export default router;
