export class PluginRepository {
  constructor(client) {
    this.client = client;
  }

  async upsert({ name, version, description, manifest }) {
    const { rows } = await this.client.query(
      `INSERT INTO plugins (name, version, description, manifest)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE
         SET version = $2, description = $3, manifest = $4, updated_at = now()
       RETURNING *`,
      [name, version, description || null, JSON.stringify(manifest)]
    );
    return rows[0];
  }

  async findAll() {
    const { rows } = await this.client.query('SELECT * FROM plugins ORDER BY name ASC');
    return rows;
  }

  async findByName(name) {
    const { rows } = await this.client.query('SELECT * FROM plugins WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async updateStatus(name, { status, error }) {
    const { rows } = await this.client.query(
      `UPDATE plugins SET status = $2, error = $3, updated_at = now() WHERE name = $1 RETURNING *`,
      [name, status, error || null]
    );
    return rows[0] || null;
  }
}
