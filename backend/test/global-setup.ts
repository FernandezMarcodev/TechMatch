import { getEnv } from '../src/config/env.js';
import { migrateUp } from '../src/infrastructure/db/migrator.js';

export default async function setup(): Promise<void> {
  const url = getEnv().TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set to run integration tests');
  await migrateUp(url);
}
