import { dbClient } from '../../src/shared/database.js';
import { createMigrationRunner } from '../../src/shared/migrations.js';
import { loadMigrations } from '../../src/migrations/index.js';
import { BaseRepository } from '../../src/shared/repositories/base-repository.js';

describe('database integration', () => {
  it('applies migrations idempotently against the real Postgres container', async () => {
    const runner = createMigrationRunner(dbClient);
    const migrations = loadMigrations();

    await runner.apply(migrations);
    const secondRunAppliedCount = await runner.apply(migrations);

    expect(secondRunAppliedCount).toBe(0);
  });

  it('performs a real create/find round trip through BaseRepository', async () => {
    const repository = new BaseRepository(dbClient, 'device_types');
    const created = await repository.create({ name: 'Integration Test Type', description: 'created by test' });

    const found = await repository.findById(created.id);
    expect(found).toMatchObject({ name: 'Integration Test Type' });

    await dbClient.query('DELETE FROM device_types WHERE id = $1', [created.id]);
  });
});
