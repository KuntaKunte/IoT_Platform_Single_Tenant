export function createMigrationRunner(client) {
  return {
    async apply(migrations) {
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
      );

      let appliedCount = 0;
      for (const migration of migrations) {
        const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migration.name]);
        if (rows.length) {
          continue;
        }

        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
        appliedCount += 1;
      }

      return appliedCount;
    }
  };
}
