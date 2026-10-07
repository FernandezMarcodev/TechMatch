import { createApp } from '../api/app.js';
import { createRoutes } from '../api/routes.js';
import { getEnv } from '../config/env.js';
import { createPool } from '../infrastructure/db/pool.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createContainer } from './container.js';
import { createJobSyncScheduler, createJobSyncService } from './job-sync.js';

const env = getEnv();
const logger = createLogger(env.LOG_LEVEL);
const pool = createPool(env.DATABASE_URL);
const container = createContainer({ pool, logger, env });

const app = createApp({
  logger,
  corsOrigin: env.CORS_ORIGIN,
  routes: createRoutes({
    cvService: container.cvService,
    queries: container.queries,
    maxUploadBytes: env.CV_MAX_SIZE_BYTES,
  }),
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'TechMatch backend listening');
});

// Job sync can also run as its own process (npm run sync-jobs -- --schedule).
const scheduler = env.JOB_SYNC_ENABLED
  ? createJobSyncScheduler(createJobSyncService(env, pool, logger), env, logger)
  : undefined;
scheduler?.start(env.JOB_SYNC_RUN_ON_START);

function shutdown(): void {
  server.close(() => {
    void Promise.all([container.runner.whenIdle(), scheduler?.stop()])
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
