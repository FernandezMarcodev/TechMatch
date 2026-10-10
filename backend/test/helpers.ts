import { getEnv } from '../src/config/env.js';
import { createPool, type DbPool } from '../src/infrastructure/db/pool.js';
import { createLogger } from '../src/infrastructure/logging/logger.js';

export const testLogger = createLogger('silent');

export function createTestPool(): DbPool {
  const url = getEnv().TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set');
  return createPool(url);
}

export async function truncateAll(pool: DbPool): Promise<void> {
  await pool.query(
    `TRUNCATE match_results, job_skills, job_offers, candidate_skills, skills,
              languages, education, experiences, projects, candidate_profiles, cvs CASCADE`,
  );
}
