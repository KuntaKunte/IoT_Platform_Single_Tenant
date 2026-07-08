import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

function formatValue(value) {
  return value === null || value === undefined ? 'n/a' : value;
}

function formatPercent(value) {
  return value === null || value === undefined ? 'n/a' : `${value.toFixed(1)}%`;
}

export function exportReportToPdf(report, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(report.name);
    if (report.description) {
      doc.fontSize(10).fillColor('gray').text(report.description);
      doc.fillColor('black');
    }
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Period: ${new Date(data.period.from).toISOString()} to ${new Date(data.period.to).toISOString()}`);
    doc.moveDown();

    if (data.alertSummary) {
      doc.fontSize(14).text('Alert Summary');
      doc.fontSize(10);
      if (data.alertSummary.length === 0) {
        doc.text('No alerts in this period.');
      }
      for (const row of data.alertSummary) {
        const avgAck = row.avgAckSeconds != null ? `${row.avgAckSeconds.toFixed(0)}s` : 'n/a';
        doc.text(`${row.severity}: ${row.count} (avg ack ${avgAck})`);
      }
      doc.moveDown();
    }

    if (data.commandSummary) {
      doc.fontSize(14).text('Command Summary');
      doc.fontSize(10);
      if (data.commandSummary.length === 0) {
        doc.text('No commands in this period.');
      }
      for (const row of data.commandSummary) {
        doc.text(`${row.status}: ${row.count}`);
      }
      doc.moveDown();
    }

    for (const metric of data.metrics) {
      doc.fontSize(14).text(metric.label);
      doc.fontSize(10);
      doc.text(
        `Current: ${formatValue(metric.trend.current)}  Previous: ${formatValue(metric.trend.previous)}  Change: ${formatPercent(metric.trend.changePercent)}`
      );
      doc.moveDown(0.25);
      if (metric.series.length === 0) {
        doc.text('No data points in this period.');
      }
      for (const point of metric.series) {
        doc.text(`${new Date(point.bucket).toISOString()}: ${formatValue(point.value)}`);
      }
      doc.moveDown();
    }

    doc.end();
  });
}

function safeSheetName(name, used) {
  let base = String(name || 'Metric')
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 28) || 'Metric';
  let candidate = base;
  let suffix = 1;
  while (used.has(candidate)) {
    candidate = `${base} (${suffix})`.slice(0, 31);
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export async function exportReportToExcel(report, data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IoT Platform';
  const usedSheetNames = new Set();

  const summarySheet = workbook.addWorksheet(safeSheetName('Summary', usedSheetNames));
  summarySheet.addRow(['Report', report.name]);
  summarySheet.addRow(['Period From', new Date(data.period.from).toISOString()]);
  summarySheet.addRow(['Period To', new Date(data.period.to).toISOString()]);
  summarySheet.addRow([]);

  if (data.alertSummary) {
    summarySheet.addRow(['Alert Summary']);
    summarySheet.addRow(['Severity', 'Count', 'Avg Ack Seconds']);
    for (const row of data.alertSummary) {
      summarySheet.addRow([row.severity, row.count, row.avgAckSeconds]);
    }
    summarySheet.addRow([]);
  }

  if (data.commandSummary) {
    summarySheet.addRow(['Command Summary']);
    summarySheet.addRow(['Status', 'Count']);
    for (const row of data.commandSummary) {
      summarySheet.addRow([row.status, row.count]);
    }
  }

  for (const metric of data.metrics) {
    const sheet = workbook.addWorksheet(safeSheetName(metric.label, usedSheetNames));
    sheet.addRow(['Bucket', 'Value']);
    for (const point of metric.series) {
      sheet.addRow([new Date(point.bucket).toISOString(), point.value]);
    }
    sheet.addRow([]);
    sheet.addRow(['Current', metric.trend.current]);
    sheet.addRow(['Previous', metric.trend.previous]);
    sheet.addRow(['Change %', metric.trend.changePercent]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
