import { getEnv } from '../config/env.js';
import { migrateUp } from '../infrastructure/db/migrator.js';

const env = getEnv();
const target = process.argv.includes('--test') ? env.TEST_DATABASE_URL : env.DATABASE_URL;
if (!target) {
  throw new Error('TEST_DATABASE_URL is not configured');
}
await migrateUp(target);
console.log('Migrations applied');
