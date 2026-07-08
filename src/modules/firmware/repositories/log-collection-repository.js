export class LogCollectionRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ deviceId }) {
    const { rows } = await this.client.query(
      `INSERT INTO log_collections (device_id) VALUES ($1) RETURNING *`,
      [deviceId]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.client.query('SELECT * FROM log_collections WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByDevice(deviceId) {
    const { rows } = await this.client.query(
      `SELECT * FROM log_collections WHERE device_id = $1 ORDER BY created_at DESC`,
      [deviceId]
    );
    return rows;
  }

  async linkCommand(id, commandId) {
    const { rows } = await this.client.query(
      `UPDATE log_collections SET command_id = $2 WHERE id = $1 RETURNING *`,
      [id, commandId]
    );
    return rows[0];
  }

  async markUploaded(id, { storageKey, sizeBytes }) {
    const { rows } = await this.client.query(
      `UPDATE log_collections SET status = 'uploaded', storage_key = $2, size_bytes = $3, uploaded_at = now() WHERE id = $1 RETURNING *`,
      [id, storageKey, sizeBytes]
    );
    return rows[0];
  }
}
