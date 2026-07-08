export class DeviceStatusRepository {
  constructor(client) {
    this.client = client;
  }

  async touch(deviceId, topic) {
    const { rows } = await this.client.query(
      `INSERT INTO device_status (device_id, online, last_seen_at, last_topic, updated_at)
       VALUES ($1, true, now(), $2, now())
       ON CONFLICT (device_id) DO UPDATE
         SET online = true, last_seen_at = now(), last_topic = $2, updated_at = now()
       RETURNING *`,
      [deviceId, topic]
    );
    return rows[0];
  }

  async findByDeviceId(deviceId) {
    const { rows } = await this.client.query('SELECT * FROM device_status WHERE device_id = $1', [deviceId]);
    return rows[0] || null;
  }

  async markStaleOffline(thresholdMs) {
    const { rows } = await this.client.query(
      `UPDATE device_status
       SET online = false, updated_at = now()
       WHERE online = true AND last_seen_at < now() - ($1 * interval '1 millisecond')
       RETURNING device_id`,
      [thresholdMs]
    );
    return rows;
  }
}
