import { pathToFileURL } from 'url';
import { dbClient } from '../shared/database.js';
import { createMigrationRunner } from '../shared/migrations.js';
import { loadMigrations } from './index.js';
import { createLogger } from '../shared/logger.js';

export async function applyPendingMigrations(client) {
  const runner = createMigrationRunner(client);
  const migrations = loadMigrations();
  return runner.apply(migrations);
}

async function runCli() {
  const logger = createLogger();
  try {
    const appliedCount = await applyPendingMigrations(dbClient);
    logger.info(`Applied ${appliedCount} migration(s)`);
    await dbClient.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
