export class DeviceConfigurationRepository {
  constructor(client) {
    this.client = client;
  }

  async findByDevice(deviceId) {
    const { rows } = await this.client.query('SELECT * FROM device_configurations WHERE device_id = $1', [deviceId]);
    return rows[0] || null;
  }

  async upsertDesired(deviceId, { config, version }) {
    const { rows } = await this.client.query(
      `INSERT INTO device_configurations (device_id, desired_config, desired_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (device_id) DO UPDATE
         SET desired_config = $2, desired_version = $3, updated_at = now()
       RETURNING *`,
      [deviceId, JSON.stringify(config), version]
    );
    return rows[0];
  }

  async updateReported(deviceId, { config, version }) {
    const { rows } = await this.client.query(
      `UPDATE device_configurations
       SET reported_config = $2, reported_version = $3, updated_at = now()
       WHERE device_id = $1
       RETURNING *`,
      [deviceId, JSON.stringify(config), version]
    );
    return rows[0] || null;
  }
}
