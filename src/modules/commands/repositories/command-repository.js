export class CommandRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ deviceId, type, payload, maxAttempts, scheduledAt }) {
    const { rows } = await this.client.query(
      `INSERT INTO device_commands (device_id, type, payload, max_attempts, scheduled_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, now()))
       RETURNING *`,
      [deviceId, type, payload, maxAttempts, scheduledAt || null]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.client.query('SELECT * FROM device_commands WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByDevice(deviceId, { limit = 50 } = {}) {
    const { rows } = await this.client.query(
      `SELECT * FROM device_commands WHERE device_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [deviceId, limit]
    );
    return rows;
  }

  async findLatestByDeviceAndType(deviceId, type, status) {
    const { rows } = await this.client.query(
      `SELECT * FROM device_commands WHERE device_id = $1 AND type = $2 AND status = $3 ORDER BY created_at DESC LIMIT 1`,
      [deviceId, type, status]
    );
    return rows[0] || null;
  }

  async findDue(limit = 50) {
    const { rows } = await this.client.query(
      `SELECT * FROM device_commands
       WHERE (status = 'pending' AND scheduled_at <= now())
          OR (status = 'sent' AND next_attempt_at <= now())
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async markSent(id, nextAttemptAt) {
    const { rows } = await this.client.query(
      `UPDATE device_commands
       SET status = 'sent', sent_at = now(), attempts = attempts + 1, next_attempt_at = $2, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, nextAttemptAt]
    );
    return rows[0];
  }

  async markExpired(id) {
    const { rows } = await this.client.query(
      `UPDATE device_commands SET status = 'expired', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0];
  }

  async markAcknowledged(id, deviceId, { status, response }) {
    const { rows } = await this.client.query(
      `UPDATE device_commands
       SET status = $3, acknowledged_at = now(), response = $4, updated_at = now()
       WHERE id = $1 AND device_id = $2 AND status = 'sent'
       RETURNING *`,
      [id, deviceId, status, response]
    );
    return rows[0] || null;
  }
}
