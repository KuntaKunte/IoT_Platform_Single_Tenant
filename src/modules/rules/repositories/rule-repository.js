export class RuleRepository {
  constructor(client) {
    this.client = client;
  }

  async create({ name, description, enabled, deviceId, conditionLogic, conditions, actions }) {
    const { rows } = await this.client.query(
      `INSERT INTO rules (name, description, enabled, device_id, condition_logic, conditions, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, enabled, deviceId, conditionLogic, JSON.stringify(conditions), JSON.stringify(actions)]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.client.query('SELECT * FROM rules WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findAll() {
    const { rows } = await this.client.query('SELECT * FROM rules ORDER BY id ASC');
    return rows;
  }

  async findActiveForDevice(deviceId) {
    const { rows } = await this.client.query(
      `SELECT * FROM rules WHERE enabled = true AND (device_id = $1 OR device_id IS NULL)`,
      [deviceId]
    );
    return rows;
  }

  async update(id, { name, description, enabled, deviceId, conditionLogic, conditions, actions }) {
    const { rows } = await this.client.query(
      `UPDATE rules
       SET name = $2, description = $3, enabled = $4, device_id = $5, condition_logic = $6,
           conditions = $7, actions = $8, version = version + 1, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, name, description, enabled, deviceId, conditionLogic, JSON.stringify(conditions), JSON.stringify(actions)]
    );
    return rows[0];
  }

  async snapshotVersion(existingRule) {
    await this.client.query(
      `INSERT INTO rule_versions (rule_id, version, name, description, enabled, device_id, condition_logic, conditions, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        existingRule.id,
        existingRule.version,
        existingRule.name,
        existingRule.description,
        existingRule.enabled,
        existingRule.device_id,
        existingRule.condition_logic,
        JSON.stringify(existingRule.conditions),
        JSON.stringify(existingRule.actions)
      ]
    );
  }

  async findVersions(id) {
    const { rows } = await this.client.query(
      'SELECT * FROM rule_versions WHERE rule_id = $1 ORDER BY version DESC',
      [id]
    );
    return rows;
  }

  async recordHistory(ruleId, deviceId, payload, actionsResult) {
    const { rows } = await this.client.query(
      `INSERT INTO rule_history (rule_id, device_id, triggering_payload, actions_result)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ruleId, deviceId, payload, JSON.stringify(actionsResult)]
    );
    return rows[0];
  }

  async findHistory(id, { limit = 50 } = {}) {
    const { rows } = await this.client.query(
      'SELECT * FROM rule_history WHERE rule_id = $1 ORDER BY evaluated_at DESC LIMIT $2',
      [id, limit]
    );
    return rows;
  }
}
