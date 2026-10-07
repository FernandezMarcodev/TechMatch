import type { Env } from '../config/env.js';
import type { DbPool } from '../infrastructure/db/pool.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { GetOnBoardConnector } from '../job-sources/connectors/getonboard.js';
import { HttpClient, type HttpClientOptions } from '../job-sources/http-client.js';
import { IntervalScheduler } from '../job-sources/scheduler.js';
import { JobSyncService } from '../job-sources/sync-service.js';
import type { JobSourceConnector } from '../job-sources/types.js';
import { PgJobOfferRepository } from '../persistence/pg-job-offer-repository.js';
import { systemClock } from './container.js';

export function createJobSyncService(env: Env, pool: DbPool, logger: Logger): JobSyncService {
  const http: HttpClientOptions = {
    userAgent: env.HTTP_USER_AGENT,
    timeoutMs: env.HTTP_TIMEOUT_MS,
    maxRetries: env.HTTP_MAX_RETRIES,
    minDelayMs: env.HTTP_REQUEST_DELAY_MS,
    backoffBaseMs: env.HTTP_BACKOFF_BASE_MS,
  };
  const connectors: JobSourceConnector[] = [];
  if (env.GETONBOARD_ENABLED) {
    connectors.push(
      new GetOnBoardConnector(
        new HttpClient('getonboard', http),
        {
          apiUrl: env.GETONBOARD_API_URL,
          categories: env.GETONBOARD_CATEGORIES,
          perPage: env.GETONBOARD_PER_PAGE,
          maxOffers: env.JOB_SYNC_MAX_OFFERS_PER_SOURCE,
        },
        logger,
      ),
    );
  }
  return new JobSyncService(connectors, new PgJobOfferRepository(pool), systemClock, logger);
}

export function createJobSyncScheduler(service: JobSyncService, env: Env, logger: Logger) {
  return new IntervalScheduler(() => service.syncAll(), env.JOB_SYNC_INTERVAL_HOURS, logger);
}
