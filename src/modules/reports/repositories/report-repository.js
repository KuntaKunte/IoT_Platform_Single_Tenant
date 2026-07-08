import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class ReportRepository extends BaseRepository {
  constructor(client) {
    super(client, 'reports');
  }

  async create({ name, description, deviceIds, metrics, includeAlertSummary, includeCommandSummary, bucketInterval, periodDays }) {
    const { rows } = await this.client.query(
      `INSERT INTO reports (name, description, device_ids, metrics, include_alert_summary, include_command_summary, bucket_interval, period_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, description, JSON.stringify(deviceIds), JSON.stringify(metrics), includeAlertSummary, includeCommandSummary, bucketInterval, periodDays]
    );
    return rows[0];
  }

  async update(id, { name, description, deviceIds, metrics, includeAlertSummary, includeCommandSummary, bucketInterval, periodDays }) {
    const { rows } = await this.client.query(
      `UPDATE reports
       SET name = $2, description = $3, device_ids = $4, metrics = $5,
           include_alert_summary = $6, include_command_summary = $7, bucket_interval = $8, period_days = $9,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, name, description, JSON.stringify(deviceIds), JSON.stringify(metrics), includeAlertSummary, includeCommandSummary, bucketInterval, periodDays]
    );
    return rows[0];
  }

  async delete(id) {
    await this.client.query('DELETE FROM reports WHERE id = $1', [id]);
  }
}
