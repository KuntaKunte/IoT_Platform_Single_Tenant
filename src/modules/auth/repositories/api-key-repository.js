import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class ApiKeyRepository extends BaseRepository {
  constructor(client) {
    super(client, 'api_keys');
  }

  async findByKey(key) {
    const { rows } = await this.client.query('SELECT * FROM api_keys WHERE key = $1', [key]);
    return rows[0] || null;
  }
}
