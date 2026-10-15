import { createApp } from '../api/app.js';
import { createRoutes } from '../api/routes.js';
import { frontendUrl, getEnv } from '../config/env.js';
import { createEmailSender } from '../infrastructure/email/create-email-sender.js';
import { createPool } from '../infrastructure/db/pool.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createContainer } from './container.js';
import { createJobSyncScheduler, createJobSyncService } from './job-sync.js';

const env = getEnv();
const logger = createLogger(env.LOG_LEVEL);
const pool = createPool(env.DATABASE_URL);
const container = createContainer({
  pool,
  logger,
  env,
  frontendUrl: frontendUrl(env),
  emailSender: createEmailSender(env),
});

const app = createApp({
  logger,
  corsOrigin: env.CORS_ORIGIN,
  trustProxy: env.TRUST_PROXY,
  frontendDir: env.FRONTEND_DIST_DIR,
  routes: createRoutes({
    cvService: container.cvService,
    queries: container.queries,
    adaptation: container.adaptation,
    auth: container.auth,
    stats: container.stats,
    maxUploadBytes: env.CV_MAX_SIZE_BYTES,
    anonymousRecommendationsLimit: env.ANONYMOUS_RECOMMENDATIONS_LIMIT,
    uploadRateLimit: {
      max: env.CV_UPLOAD_LIMIT_MAX,
      windowMs: env.CV_UPLOAD_LIMIT_WINDOW_MINUTES * 60_000,
    },
    authRateLimit: {
      max: env.AUTH_LIMIT_MAX,
      windowMs: env.AUTH_LIMIT_WINDOW_MINUTES * 60_000,
    },
  }),
});

// Before accepting requests: CVs left mid-processing by a previous run cannot finish.
await container.cvService.recoverInterrupted();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'TechMatch backend listening');
});

// Job sync can also run as its own process (npm run sync-jobs -- --schedule).
const scheduler = env.JOB_SYNC_ENABLED
  ? createJobSyncScheduler(createJobSyncService(env, pool, logger), env, logger, () =>
      container.cvService.recalculateAll(),
    )
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
