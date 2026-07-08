import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class UserRepository extends BaseRepository {
  constructor(client) {
    super(client, 'users');
  }

  async findByEmail(email) {
    const { rows } = await this.client.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }
}
