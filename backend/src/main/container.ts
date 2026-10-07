import { randomUUID } from 'node:crypto';
import { CvService } from '../application/cv-service.js';
import { MatchingService } from '../application/matching-service.js';
import type { Clock, IdGenerator } from '../application/ports.js';
import { QueryService } from '../application/query-service.js';
import { TaskRunner } from '../application/task-runner.js';
import type { Env } from '../config/env.js';
import { loadMatchingConfig } from '../config/load-matching-config.js';
import { CvProcessor } from '../cv-processing/cv-processor.js';
import { PdfTextExtractor, disabledOcr } from '../cv-processing/text-extraction.js';
import type { DbPool } from '../infrastructure/db/pool.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { LocalFileStorage } from '../infrastructure/storage/local-file-storage.js';
import type { MatchingConfig } from '../matching/matching-config.js';
import { PgCandidateProfileRepository } from '../persistence/pg-candidate-profile-repository.js';
import { PgCvRepository } from '../persistence/pg-cv-repository.js';
import { PgJobOfferRepository } from '../persistence/pg-job-offer-repository.js';
import { PgMatchResultRepository } from '../persistence/pg-match-result-repository.js';

export const systemClock: Clock = { now: () => new Date() };
export const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export interface ContainerOptions {
  pool: DbPool;
  logger: Logger;
  env: Pick<
    Env,
    'CV_MAX_SIZE_BYTES' | 'CV_STORAGE_DIR' | 'CV_MIN_TEXT_CHARS' | 'MATCHING_CONFIG_PATH'
  >;
  clock?: Clock;
  matchingConfig?: MatchingConfig;
}

/** Composition root: wires infrastructure implementations into the application services. */
export function createContainer(options: ContainerOptions) {
  const { pool, logger, env } = options;
  const clock = options.clock ?? systemClock;
  const matchingConfig = options.matchingConfig ?? loadMatchingConfig(env.MATCHING_CONFIG_PATH);

  const cvs = new PgCvRepository(pool);
  const profiles = new PgCandidateProfileRepository(pool);
  const jobs = new PgJobOfferRepository(pool);
  const matches = new PgMatchResultRepository(pool);
  const extractor = new PdfTextExtractor();
  const runner = new TaskRunner(logger);
  const matching = new MatchingService(jobs, matches, matchingConfig, clock, uuidGenerator);

  const cvService = new CvService({
    cvs,
    profiles,
    storage: new LocalFileStorage(env.CV_STORAGE_DIR),
    extractor,
    processor: new CvProcessor(extractor, disabledOcr, env.CV_MIN_TEXT_CHARS),
    matching,
    runner,
    clock,
    ids: uuidGenerator,
    logger,
    maxSizeBytes: env.CV_MAX_SIZE_BYTES,
  });

  return {
    cvService,
    queries: new QueryService(cvs, jobs, matches),
    jobs,
    runner,
    clock,
  };
}

export type Container = ReturnType<typeof createContainer>;
