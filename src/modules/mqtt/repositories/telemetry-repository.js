export class TelemetryRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ deviceId, topic, payload }) {
    const { rows } = await this.client.query(
      `INSERT INTO telemetry_history (device_id, topic, payload) VALUES ($1, $2, $3) RETURNING *`,
      [deviceId, topic, payload]
    );
    return rows[0];
  }

  async findLatest(deviceId) {
    const { rows } = await this.client.query(
      `SELECT * FROM telemetry_history WHERE device_id = $1 ORDER BY received_at DESC LIMIT 1`,
      [deviceId]
    );
    return rows[0] || null;
  }

  async findHistory(deviceId, { limit = 50 } = {}) {
    const { rows } = await this.client.query(
      `SELECT * FROM telemetry_history WHERE device_id = $1 ORDER BY received_at DESC LIMIT $2`,
      [deviceId, limit]
    );
    return rows;
  }
}
