import { dbClient } from '../../../shared/database.js';

const AGGREGATION_FUNCTIONS = {
  avg: 'AVG',
  min: 'MIN',
  max: 'MAX',
  sum: 'SUM',
  count: 'COUNT'
};

function fieldPath(field) {
  return field.split('.');
}

function deviceIdsClause(deviceIds, paramIndex) {
  if (!deviceIds || deviceIds.length === 0) {
    return { clause: '', params: [] };
  }
  return { clause: ` AND device_id = ANY($${paramIndex}::int[])`, params: [deviceIds] };
}

export async function aggregateMetricSeries({ deviceIds, field, aggregation, bucketInterval, from, to }) {
  const fn = AGGREGATION_FUNCTIONS[aggregation];
  const { clause, params: deviceParams } = deviceIdsClause(deviceIds, 5);
  const { rows } = await dbClient.query(
    `SELECT date_trunc($1, received_at) AS bucket,
            ${fn}((payload #>> $2::text[])::numeric) AS value
     FROM telemetry_history
     WHERE received_at >= $3 AND received_at < $4${clause}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [bucketInterval, fieldPath(field), from, to, ...deviceParams]
  );
  return rows.map((row) => ({ bucket: row.bucket, value: row.value === null ? null : Number(row.value) }));
}

export async function aggregateMetricValue({ deviceIds, field, aggregation, from, to }) {
  const fn = AGGREGATION_FUNCTIONS[aggregation];
  const { clause, params: deviceParams } = deviceIdsClause(deviceIds, 4);
  const { rows } = await dbClient.query(
    `SELECT ${fn}((payload #>> $1::text[])::numeric) AS value
     FROM telemetry_history
     WHERE received_at >= $2 AND received_at < $3${clause}`,
    [fieldPath(field), from, to, ...deviceParams]
  );
  const value = rows[0]?.value;
  return value === null || value === undefined ? null : Number(value);
}

export async function aggregateAlertSummary({ deviceIds, from, to }) {
  const { clause, params: deviceParams } = deviceIdsClause(deviceIds, 3);
  const { rows } = await dbClient.query(
    `SELECT severity, count(*) AS count,
            AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) FILTER (WHERE acknowledged_at IS NOT NULL) AS avg_ack_seconds
     FROM alerts
     WHERE created_at >= $1 AND created_at < $2${clause}
     GROUP BY severity
     ORDER BY severity ASC`,
    [from, to, ...deviceParams]
  );
  return rows.map((row) => ({
    severity: row.severity,
    count: Number(row.count),
    avgAckSeconds: row.avg_ack_seconds === null ? null : Number(row.avg_ack_seconds)
  }));
}

export async function aggregateCommandSummary({ deviceIds, from, to }) {
  const { clause, params: deviceParams } = deviceIdsClause(deviceIds, 3);
  const { rows } = await dbClient.query(
    `SELECT status, count(*) AS count
     FROM device_commands
     WHERE created_at >= $1 AND created_at < $2${clause}
     GROUP BY status
     ORDER BY status ASC`,
    [from, to, ...deviceParams]
  );
  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}
