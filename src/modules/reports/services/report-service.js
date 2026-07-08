import { dbClient } from '../../../shared/database.js';
import {
  createReportSchema,
  updateReportSchema,
  createScheduleSchema,
  updateScheduleSchema
} from '../validation.js';
import { ReportRepository } from '../repositories/report-repository.js';
import { ReportScheduleRepository } from '../repositories/report-schedule-repository.js';
import { ReportRunRepository } from '../repositories/report-run-repository.js';
import {
  aggregateMetricSeries,
  aggregateMetricValue,
  aggregateAlertSummary,
  aggregateCommandSummary
} from './aggregation-service.js';

const reportRepository = new ReportRepository(dbClient);
const scheduleRepository = new ReportScheduleRepository(dbClient);
const runRepository = new ReportRunRepository(dbClient);

export async function createReport(input) {
  const { error, value } = createReportSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  return reportRepository.create(value);
}

export async function getReport(id) {
  const report = await reportRepository.findById(id);
  if (!report) {
    throw Object.assign(new Error('Report not found'), { status: 404 });
  }
  return report;
}

export async function listReports() {
  return reportRepository.findAll();
}

export async function updateReport(id, input) {
  const { error, value } = updateReportSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  await getReport(id);
  return reportRepository.update(id, value);
}

export async function deleteReport(id) {
  await getReport(id);
  await reportRepository.delete(id);
}

function resolvePeriod(report, { from, to } = {}) {
  const effectiveTo = to ? new Date(to) : new Date();
  const effectiveFrom = from ? new Date(from) : new Date(effectiveTo.getTime() - report.period_days * 24 * 60 * 60 * 1000);
  const durationMs = effectiveTo.getTime() - effectiveFrom.getTime();
  const previousTo = effectiveFrom;
  const previousFrom = new Date(effectiveFrom.getTime() - durationMs);
  return { from: effectiveFrom, to: effectiveTo, previousFrom, previousTo };
}

function changePercent(current, previous) {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function getReportData(id, { from, to } = {}) {
  const report = await getReport(id);
  const deviceIds = report.device_ids && report.device_ids.length ? report.device_ids : null;
  const range = resolvePeriod(report, { from, to });

  const metrics = await Promise.all(
    report.metrics.map(async (metric) => {
      const series = await aggregateMetricSeries({
        deviceIds,
        field: metric.field,
        aggregation: metric.aggregation,
        bucketInterval: report.bucket_interval,
        from: range.from,
        to: range.to
      });
      const current = await aggregateMetricValue({
        deviceIds,
        field: metric.field,
        aggregation: metric.aggregation,
        from: range.from,
        to: range.to
      });
      const previous = await aggregateMetricValue({
        deviceIds,
        field: metric.field,
        aggregation: metric.aggregation,
        from: range.previousFrom,
        to: range.previousTo
      });
      return {
        field: metric.field,
        label: metric.label,
        aggregation: metric.aggregation,
        series,
        trend: { current, previous, changePercent: changePercent(current, previous) }
      };
    })
  );

  const alertSummary = report.include_alert_summary
    ? await aggregateAlertSummary({ deviceIds, from: range.from, to: range.to })
    : null;
  const commandSummary = report.include_command_summary
    ? await aggregateCommandSummary({ deviceIds, from: range.from, to: range.to })
    : null;

  return {
    reportId: id,
    period: { from: range.from, to: range.to },
    metrics,
    alertSummary,
    commandSummary
  };
}

export function computeNextRunAt(schedule, from = new Date()) {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(schedule.hour_of_day ?? schedule.hourOfDay ?? 8);

  if (schedule.frequency === 'daily') {
    if (next <= from) next.setDate(next.getDate() + 1);
    return next;
  }

  if (schedule.frequency === 'weekly') {
    const targetDay = schedule.day_of_week ?? schedule.dayOfWeek ?? 0;
    while (next.getDay() !== targetDay || next <= from) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (schedule.frequency === 'monthly') {
    const targetDate = schedule.day_of_month ?? schedule.dayOfMonth ?? 1;
    next.setDate(targetDate);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDate);
    }
    return next;
  }

  throw Object.assign(new Error(`Unknown schedule frequency: ${schedule.frequency}`), { status: 400 });
}

export async function createSchedule(reportId, input) {
  await getReport(reportId);
  const { error, value } = createScheduleSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  const nextRunAt = computeNextRunAt(value);
  return scheduleRepository.create({ reportId, ...value, nextRunAt });
}

export async function getSchedule(reportId, scheduleId) {
  const schedule = await scheduleRepository.findById(scheduleId);
  if (!schedule || schedule.report_id !== reportId) {
    throw Object.assign(new Error('Schedule not found'), { status: 404 });
  }
  return schedule;
}

export async function listSchedulesForReport(reportId) {
  await getReport(reportId);
  return scheduleRepository.findByReport(reportId);
}

export async function updateSchedule(reportId, scheduleId, input) {
  await getSchedule(reportId, scheduleId);
  const { error, value } = updateScheduleSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  const nextRunAt = computeNextRunAt(value);
  return scheduleRepository.update(scheduleId, { ...value, nextRunAt });
}

export async function deleteSchedule(reportId, scheduleId) {
  await getSchedule(reportId, scheduleId);
  await scheduleRepository.delete(scheduleId);
}

export async function listRuns(reportId) {
  await getReport(reportId);
  return runRepository.findByReport(reportId);
}

export { scheduleRepository, runRepository };
