import { createLogger } from '../../shared/logger.js';
import { sendEmail } from '../notifications/channels/email.js';
import {
  getReport,
  getReportData,
  computeNextRunAt,
  scheduleRepository,
  runRepository
} from './services/report-service.js';
import { exportReportToPdf, exportReportToExcel } from './services/export-service.js';

const logger = createLogger();

function attachmentFor(format, buffer) {
  return format === 'excel'
    ? { filename: 'report.xlsx', content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    : { filename: 'report.pdf', content: buffer, contentType: 'application/pdf' };
}

async function runSchedule(schedule) {
  const report = await getReport(schedule.report_id);
  const data = await getReportData(schedule.report_id);
  const buffer =
    schedule.format === 'excel' ? await exportReportToExcel(report, data) : await exportReportToPdf(report, data);
  const attachment = attachmentFor(schedule.format, buffer);

  for (const recipient of schedule.recipients) {
    await sendEmail(recipient, {
      subject: `Report: ${report.name}`,
      body: `Attached is the scheduled "${report.name}" report for the period ${new Date(data.period.from).toISOString()} to ${new Date(data.period.to).toISOString()}.`,
      attachments: [attachment]
    });
  }
}

export async function dispatchDueReportSchedules() {
  const dueSchedules = await scheduleRepository.findDue(new Date());
  let dispatched = 0;

  for (const schedule of dueSchedules) {
    const now = new Date();
    try {
      await runSchedule(schedule);
      await runRepository.create({
        reportId: schedule.report_id,
        scheduleId: schedule.id,
        status: 'success',
        recipients: schedule.recipients
      });
      dispatched += 1;
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id }, 'Report schedule run failed');
      await runRepository.create({
        reportId: schedule.report_id,
        scheduleId: schedule.id,
        status: 'failed',
        error: err.message,
        recipients: schedule.recipients
      });
    }

    const nextRunAt = computeNextRunAt(schedule, now);
    await scheduleRepository.markRun(schedule.id, { nextRunAt, lastRunAt: now });
  }

  return { dispatched };
}

export function startReportDispatcher({ intervalMs }) {
  const timer = setInterval(async () => {
    try {
      const { dispatched } = await dispatchDueReportSchedules();
      if (dispatched) {
        logger.info({ dispatched }, 'Report dispatch sweep completed');
      }
    } catch (err) {
      logger.error({ err }, 'Report dispatch sweep failed');
    }
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
