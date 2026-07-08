export class ReportScheduleRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ reportId, frequency, hourOfDay, dayOfWeek, dayOfMonth, recipients, format, active, nextRunAt }) {
    const { rows } = await this.client.query(
      `INSERT INTO report_schedules (report_id, frequency, hour_of_day, day_of_week, day_of_month, recipients, format, active, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [reportId, frequency, hourOfDay, dayOfWeek ?? null, dayOfMonth ?? null, JSON.stringify(recipients), format, active, nextRunAt]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.client.query('SELECT * FROM report_schedules WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByReport(reportId) {
    const { rows } = await this.client.query(
      'SELECT * FROM report_schedules WHERE report_id = $1 ORDER BY id ASC',
      [reportId]
    );
    return rows;
  }

  async update(id, { frequency, hourOfDay, dayOfWeek, dayOfMonth, recipients, format, active, nextRunAt }) {
    const { rows } = await this.client.query(
      `UPDATE report_schedules
       SET frequency = $2, hour_of_day = $3, day_of_week = $4, day_of_month = $5,
           recipients = $6, format = $7, active = $8, next_run_at = $9, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, frequency, hourOfDay, dayOfWeek ?? null, dayOfMonth ?? null, JSON.stringify(recipients), format, active, nextRunAt]
    );
    return rows[0] || null;
  }

  async delete(id) {
    await this.client.query('DELETE FROM report_schedules WHERE id = $1', [id]);
  }

  async findDue(now = new Date(), limit = 50) {
    const { rows } = await this.client.query(
      `SELECT * FROM report_schedules WHERE active = true AND next_run_at <= $1 ORDER BY next_run_at ASC LIMIT $2`,
      [now, limit]
    );
    return rows;
  }

  async markRun(id, { nextRunAt, lastRunAt }) {
    const { rows } = await this.client.query(
      `UPDATE report_schedules SET next_run_at = $2, last_run_at = $3, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, nextRunAt, lastRunAt]
    );
    return rows[0];
  }
}
