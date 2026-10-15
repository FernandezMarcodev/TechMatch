import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { MemoryEmailSender } from '../src/infrastructure/email/memory-email-sender.js';
import type { SourceSyncSummary } from '../src/job-sources/sync-service.js';
import { createContainer, type Container } from '../src/main/container.js';
import { syncAndRecalculate } from '../src/main/job-sync.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { jobSkills, makeCv, makeOffer } from './fixtures.js';
import { createSession, createTestPool, testLogger, truncateAll } from './helpers.js';
import { SAMPLE_CV_LINES, makePdf } from './support/make-pdf.js';

const pool = createTestPool();
let storageDir: string;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-recalc-'));
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: 1_000_000,
      CV_STORAGE_DIR: storageDir,
      CV_MIN_TEXT_CHARS: 50,
      MATCHING_CONFIG_PATH: undefined,
      SESSION_TTL_DAYS: 30,
      EMAIL_VERIFICATION_TTL_HOURS: 24,
      PASSWORD_RESET_TTL_MINUTES: 30,
      STATS_CACHE_MINUTES: 0,
      STATS_TOP_SKILLS: 15,
      STATS_TOP_COMPANIES: 10,
    },
    frontendUrl: 'http://techmatch.test',
    emailSender: new MemoryEmailSender(),
  });
  app = createApp({
    logger: testLogger,
    corsOrigin: '*',
    routes: createRoutes({
      cvService: container.cvService,
      queries: container.queries,
      adaptation: container.adaptation,
      auth: container.auth,
      stats: container.stats,
      maxUploadBytes: 1_000_000,
      anonymousRecommendationsLimit: 3,
    }),
  });
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await container.runner.whenIdle();
  await pool.end();
  await rm(storageDir, { recursive: true, force: true });
});

const titles = async (cvId: string, session: string) =>
  (
    await request(app).get(`/api/recommendations/${cvId}`).set('Authorization', session)
  ).body.data.recommendations.map((r: { job: { title: string } }) => r.job.title) as string[];

describe('recalculating recommendations after a job sync', () => {
  it('adds the new offers to an analyzed CV and drops the closed ones', async () => {
    const firstSync = new Date('2026-10-01T00:00:00Z');
    await container.jobs.upsert(
      makeOffer({
        title: 'Oferta vieja',
        skills: jobSkills(['Java', 'Spring Boot', 'PostgreSQL']),
      }),
      firstSync,
    );
    const upload = await request(app)
      .post('/api/cvs')
      .attach('file', makePdf(SAMPLE_CV_LINES), 'cv.pdf');
    await container.runner.whenIdle();
    const cvId = upload.body.data.cvId as string;
    const session = await createSession(pool);
    expect(await titles(cvId, session)).toEqual(['Oferta vieja']);

    // Next sync: a new matching offer appears and the old one is no longer published.
    const secondSync = new Date('2026-10-02T00:00:00Z');
    await container.jobs.upsert(
      makeOffer({ title: 'Oferta nueva', skills: jobSkills(['Java', 'Spring Boot', 'Docker']) }),
      secondSync,
    );
    await container.jobs.markUnseenInactive('getonboard', secondSync);

    // Unprocessed and failed CVs are skipped.
    const cvs = new PgCvRepository(pool);
    await cvs.create(makeCv({ processingStatus: 'FAILED' }));
    await cvs.create(makeCv({ processingStatus: 'PROCESSING' }));

    expect(await container.cvService.recalculateAll()).toEqual({ recalculated: 1, failed: 0 });
    expect(await titles(cvId, session)).toEqual(['Oferta nueva']);
  });

  it('does nothing when there are no analyzed CVs', async () => {
    expect(await container.cvService.recalculateAll()).toEqual({ recalculated: 0, failed: 0 });
  });
});

describe('syncAndRecalculate', () => {
  const summary = (status: 'ok' | 'failed') => ({ status }) as SourceSyncSummary;

  it('recalculates when at least one source synced, not when every source failed', async () => {
    const recalculate = vi.fn().mockResolvedValue(undefined);
    await syncAndRecalculate(
      { syncAll: () => Promise.resolve([summary('failed'), summary('ok')]) },
      recalculate,
    );
    expect(recalculate).toHaveBeenCalledTimes(1);

    await syncAndRecalculate(
      { syncAll: () => Promise.resolve([summary('failed'), summary('failed')]) },
      recalculate,
    );
    expect(recalculate).toHaveBeenCalledTimes(1);
  });
});
