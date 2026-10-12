/**
 * Deletes CVs older than CV_RETENTION_DAYS (default 30) with their profiles and results.
 *   npm run purge-cvs -w backend
 * In production it runs from .github/workflows/sync-jobs.yml, right after the offers sync.
 */
import { getEnv } from '../config/env.js';
import { createPool } from '../infrastructure/db/pool.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createContainer } from './container.js';

const env = getEnv();
const logger = createLogger(env.LOG_LEVEL);
const pool = createPool(env.DATABASE_URL);
const { cvService } = createContainer({ pool, logger, env });

try {
  await cvService.purgeExpired(env.CV_RETENTION_DAYS);
} finally {
  await pool.end();
}
