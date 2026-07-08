import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class DashboardTemplateRepository extends BaseRepository {
  constructor(client) {
    super(client, 'dashboard_templates');
  }

  async create({ name, description, layout }) {
    const { rows } = await this.client.query(
      `INSERT INTO dashboard_templates (name, description, layout) VALUES ($1, $2, $3) RETURNING *`,
      [name, description, JSON.stringify(layout)]
    );
    return rows[0];
  }
}
