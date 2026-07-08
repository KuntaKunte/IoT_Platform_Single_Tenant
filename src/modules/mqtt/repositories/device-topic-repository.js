export class DeviceTopicRepository {
  constructor(client) {
    this.client = client;
  }

  async upsert(deviceId, topic) {
    const { rows } = await this.client.query(
      `INSERT INTO device_topics (device_id, topic, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (device_id) DO UPDATE SET topic = $2, updated_at = now()
       RETURNING *`,
      [deviceId, topic]
    );
    return rows[0];
  }
}
