import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const migrationsDir = path.dirname(fileURLToPath(import.meta.url));

export function loadMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: path.basename(file, '.sql'),
      sql: fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    }));
}
