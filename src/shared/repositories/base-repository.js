export class BaseRepository {
  constructor(client, tableName) {
    this.client = client;
    this.tableName = tableName;
  }

  async findAll() {
    const { rows } = await this.client.query(`SELECT * FROM ${this.tableName} ORDER BY id ASC`);
    return rows;
  }

  async findById(id) {
    const { rows } = await this.client.query(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async create(record) {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = columns.map((_, index) => `$${index + 1}`);

    const { rows } = await this.client.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    return rows[0];
  }
}
