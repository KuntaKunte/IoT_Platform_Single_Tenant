export class NotificationDeliveryRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ alertId, channel, recipient, maxAttempts }) {
    const { rows } = await this.client.query(
      `INSERT INTO notification_deliveries (alert_id, channel, recipient, max_attempts)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [alertId, channel, recipient, maxAttempts]
    );
    return rows[0];
  }

  async findDue(limit = 50) {
    const { rows } = await this.client.query(
      `SELECT * FROM notification_deliveries WHERE status = 'pending' AND next_attempt_at <= now() LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async markSent(id) {
    const { rows } = await this.client.query(
      `UPDATE notification_deliveries SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async markFailed(id, error) {
    const { rows } = await this.client.query(
      `UPDATE notification_deliveries SET status = 'failed', error = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, error]
    );
    return rows[0];
  }

  async markRetry(id, nextAttemptAt, error) {
    const { rows } = await this.client.query(
      `UPDATE notification_deliveries
       SET attempts = attempts + 1, next_attempt_at = $2, error = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, nextAttemptAt, error]
    );
    return rows[0];
  }

  async findByAlert(alertId) {
    const { rows } = await this.client.query(
      'SELECT * FROM notification_deliveries WHERE alert_id = $1 ORDER BY created_at DESC',
      [alertId]
    );
    return rows;
  }
}
