import { dbClient } from '../src/shared/database.js';
import { applyPendingMigrations } from '../src/migrations/run-migrations.js';
import { storageClient } from '../src/shared/storage.js';

export default async function globalSetup() {
  await dbClient.connect();
  await applyPendingMigrations(dbClient);
  await dbClient.disconnect();
  await storageClient.ensureBucket();
}
