import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class TemplateRepository extends BaseRepository {
  constructor(client) {
    super(client, 'notification_templates');
  }

  async findByName(name) {
    const { rows } = await this.client.query('SELECT * FROM notification_templates WHERE name = $1', [name]);
    return rows[0] || null;
  }
}
