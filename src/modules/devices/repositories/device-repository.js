import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class DeviceRepository extends BaseRepository {
  constructor(client) {
    super(client, 'devices');
  }

  async search(term) {
    const { rows } = await this.client.query(
      `SELECT * FROM devices WHERE name ILIKE $1 OR metadata::text ILIKE $1 ORDER BY id ASC`,
      [`%${term}%`]
    );
    return rows;
  }

  async existsById(id) {
    const { rows } = await this.client.query('SELECT 1 FROM devices WHERE id = $1', [id]);
    return rows.length > 0;
  }
}
