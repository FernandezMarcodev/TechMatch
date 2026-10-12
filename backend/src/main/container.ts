import { randomUUID } from 'node:crypto';
import { AdaptationService } from '../application/adaptation-service.js';
import { AuthService } from '../application/auth-service.js';
import { CvService } from '../application/cv-service.js';
import { MatchingService } from '../application/matching-service.js';
import type { Clock, EmailSender, IdGenerator } from '../application/ports.js';
import { QueryService } from '../application/query-service.js';
import { TaskRunner } from '../application/task-runner.js';
import type { Env } from '../config/env.js';
import { loadMatchingConfig } from '../config/load-matching-config.js';
import { CvProcessor } from '../cv-processing/cv-processor.js';
import { PdfTextExtractor, disabledOcr } from '../cv-processing/text-extraction.js';
import type { DbPool } from '../infrastructure/db/pool.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { ScryptPasswordHasher } from '../infrastructure/security/scrypt-password-hasher.js';
import { LocalFileStorage } from '../infrastructure/storage/local-file-storage.js';
import type { MatchingConfig } from '../matching/matching-config.js';
import { PgCandidateProfileRepository } from '../persistence/pg-candidate-profile-repository.js';
import { PgCvRepository } from '../persistence/pg-cv-repository.js';
import { PgJobOfferRepository } from '../persistence/pg-job-offer-repository.js';
import { PgMatchResultRepository } from '../persistence/pg-match-result-repository.js';
import {
  PgEmailTokenRepository,
  PgSessionRepository,
  PgUserRepository,
} from '../persistence/pg-user-repository.js';

export const systemClock: Clock = { now: () => new Date() };
export const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export interface ContainerOptions {
  pool: DbPool;
  logger: Logger;
  env: Pick<
    Env,
    | 'CV_MAX_SIZE_BYTES'
    | 'CV_STORAGE_DIR'
    | 'CV_MIN_TEXT_CHARS'
    | 'MATCHING_CONFIG_PATH'
    | 'SESSION_TTL_DAYS'
    | 'EMAIL_VERIFICATION_TTL_HOURS'
    | 'PASSWORD_RESET_TTL_MINUTES'
  >;
  /** Base of the links in the emails (see `frontendUrl` in config/env.ts). */
  frontendUrl: string;
  /** Built from EMAIL_PROVIDER by the entry points (`createEmailSender`); in memory in tests. */
  emailSender: EmailSender;
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
    adaptation: new AdaptationService(cvs, profiles, jobs, matchingConfig, clock),
    auth: new AuthService({
      users: new PgUserRepository(pool),
      sessions: new PgSessionRepository(pool),
      emailTokens: new PgEmailTokenRepository(pool),
      email: options.emailSender,
      hasher: new ScryptPasswordHasher(),
      clock,
      ids: uuidGenerator,
      logger,
      sessionTtlDays: env.SESSION_TTL_DAYS,
      verificationTtlHours: env.EMAIL_VERIFICATION_TTL_HOURS,
      passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      frontendUrl: options.frontendUrl,
    }),
    jobs,
    runner,
    clock,
  };
}

export type Container = ReturnType<typeof createContainer>;
