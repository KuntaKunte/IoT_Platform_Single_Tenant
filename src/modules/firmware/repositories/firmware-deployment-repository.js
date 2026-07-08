export class FirmwareDeploymentRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ deviceId, firmwareId, commandId, isRollback }) {
    const { rows } = await this.client.query(
      `INSERT INTO firmware_deployments (device_id, firmware_id, command_id, is_rollback)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [deviceId, firmwareId, commandId, isRollback]
    );
    return rows[0];
  }

  async findByDevice(deviceId) {
    const { rows } = await this.client.query(
      `SELECT fd.*, dc.status AS command_status, dc.response AS command_response,
              fv.version AS firmware_version, fv.device_type AS firmware_device_type
       FROM firmware_deployments fd
       JOIN device_commands dc ON dc.id = fd.command_id
       JOIN firmware_versions fv ON fv.id = fd.firmware_id
       WHERE fd.device_id = $1
       ORDER BY fd.created_at DESC`,
      [deviceId]
    );
    return rows;
  }

  async findLatestSuccessful(deviceId, { excludeId } = {}) {
    const { rows } = await this.client.query(
      `SELECT fd.*, dc.status AS command_status, fv.version AS firmware_version
       FROM firmware_deployments fd
       JOIN device_commands dc ON dc.id = fd.command_id
       JOIN firmware_versions fv ON fv.id = fd.firmware_id
       WHERE fd.device_id = $1 AND dc.status = 'acknowledged' AND fd.id != COALESCE($2, -1)
       ORDER BY fd.created_at DESC
       LIMIT 1`,
      [deviceId, excludeId ?? null]
    );
    return rows[0] || null;
  }
}
