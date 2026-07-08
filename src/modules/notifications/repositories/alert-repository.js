export class AlertRepository {
  constructor(client) {
    this.client = client;
  }

  async create({
    source,
    ruleId,
    deviceId,
    severity,
    title,
    message,
    templateId,
    templateData,
    escalationPolicy,
    escalationLevel,
    nextEscalationAt
  }) {
    const { rows } = await this.client.query(
      `INSERT INTO alerts (source, rule_id, device_id, severity, title, message, template_id, template_data,
                            escalation_policy, escalation_level, next_escalation_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        source,
        ruleId,
        deviceId,
        severity,
        title,
        message,
        templateId,
        JSON.stringify(templateData),
        JSON.stringify(escalationPolicy),
        escalationLevel,
        nextEscalationAt
      ]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.client.query('SELECT * FROM alerts WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findAll() {
    const { rows } = await this.client.query('SELECT * FROM alerts ORDER BY id DESC');
    return rows;
  }

  async acknowledge(id) {
    const { rows } = await this.client.query(
      `UPDATE alerts
       SET status = 'acknowledged', acknowledged_at = now(), next_escalation_at = NULL, updated_at = now()
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  async findDueEscalations(limit = 50) {
    const { rows } = await this.client.query(
      `SELECT * FROM alerts
       WHERE status = 'active' AND next_escalation_at IS NOT NULL AND next_escalation_at <= now()
       ORDER BY next_escalation_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async advanceEscalation(id, { escalationLevel, nextEscalationAt }) {
    const { rows } = await this.client.query(
      `UPDATE alerts
       SET escalation_level = $2, next_escalation_at = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, escalationLevel, nextEscalationAt]
    );
    return rows[0];
  }
}
