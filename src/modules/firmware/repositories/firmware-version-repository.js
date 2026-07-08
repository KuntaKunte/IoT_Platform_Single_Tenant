import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class FirmwareVersionRepository extends BaseRepository {
  constructor(client) {
    super(client, 'firmware_versions');
  }

  async findByDeviceType(deviceType) {
    const { rows } = await this.client.query(
      `SELECT * FROM firmware_versions WHERE device_type = $1 ORDER BY created_at DESC`,
      [deviceType]
    );
    return rows;
  }

  async findByTypeAndVersion(deviceType, version) {
    const { rows } = await this.client.query(
      `SELECT * FROM firmware_versions WHERE device_type = $1 AND version = $2`,
      [deviceType, version]
    );
    return rows[0] || null;
  }
}
