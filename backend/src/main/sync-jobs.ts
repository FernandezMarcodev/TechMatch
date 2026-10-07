/**
 * Job offers synchronization, independent from the API process.
 *   npm run sync-jobs               -> one sync of every enabled source, then exit
 *   npm run sync-jobs -- --schedule -> sync every JOB_SYNC_INTERVAL_HOURS (default 12)
 */
import { getEnv } from '../config/env.js';
import { createPool } from '../infrastructure/db/pool.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createJobSyncScheduler, createJobSyncService } from './job-sync.js';

const env = getEnv();
const logger = createLogger(env.LOG_LEVEL);
const pool = createPool(env.DATABASE_URL);
const service = createJobSyncService(env, pool, logger);

if (process.argv.includes('--schedule')) {
  const scheduler = createJobSyncScheduler(service, env, logger);
  scheduler.start(true);
  const keepAlive = setInterval(() => undefined, 1 << 30);
  const stop = () => {
    clearInterval(keepAlive);
    void scheduler.stop().then(() => pool.end());
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  const summaries = await service.syncAll();
  await pool.end();
  process.exitCode = summaries.every((s) => s.status === 'ok') ? 0 : 1;
}
