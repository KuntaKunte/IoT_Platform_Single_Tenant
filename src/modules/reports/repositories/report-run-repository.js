export class ReportRunRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ reportId, scheduleId, status, error, recipients }) {
    const { rows } = await this.client.query(
      `INSERT INTO report_runs (report_id, schedule_id, status, error, recipients)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reportId, scheduleId ?? null, status, error ?? null, JSON.stringify(recipients || [])]
    );
    return rows[0];
  }

  async findByReport(reportId, { limit = 50 } = {}) {
    const { rows } = await this.client.query(
      `SELECT * FROM report_runs WHERE report_id = $1 ORDER BY generated_at DESC LIMIT $2`,
      [reportId, limit]
    );
    return rows;
  }
}
