import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class DashboardRepository extends BaseRepository {
  constructor(client) {
    super(client, 'dashboards');
  }

  async create({ name, description, layout }) {
    const { rows } = await this.client.query(
      `INSERT INTO dashboards (name, description, layout) VALUES ($1, $2, $3) RETURNING *`,
      [name, description, JSON.stringify(layout)]
    );
    return rows[0];
  }

  async update(id, { name, description, layout }) {
    const { rows } = await this.client.query(
      `UPDATE dashboards SET name = $2, description = $3, layout = $4, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, name, description, JSON.stringify(layout)]
    );
    return rows[0];
  }

  async delete(id) {
    await this.client.query('DELETE FROM dashboards WHERE id = $1', [id]);
  }
}
