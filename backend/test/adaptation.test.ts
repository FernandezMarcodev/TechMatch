import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { createContainer, type Container } from '../src/main/container.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { jobSkills, makeCv, makeOffer } from './fixtures.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';
import { SAMPLE_CV_LINES, makePdf } from './support/make-pdf.js';

const pool = createTestPool();
let storageDir: string;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-adaptation-'));
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: 1_000_000,
      CV_STORAGE_DIR: storageDir,
      CV_MIN_TEXT_CHARS: 50,
      MATCHING_CONFIG_PATH: undefined,
    },
    clock: { now: () => new Date('2026-03-01T00:00:00Z') },
  });
  app = createApp({
    logger: testLogger,
    corsOrigin: '*',
    routes: createRoutes({
      cvService: container.cvService,
      queries: container.queries,
      adaptation: container.adaptation,
      maxUploadBytes: 1_000_000,
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

async function processedCv(): Promise<string> {
  const res = await request(app)
    .post('/api/cvs')
    .attach('file', makePdf(SAMPLE_CV_LINES), 'cv.pdf');
  await container.runner.whenIdle();
  return res.body.data.cvId as string;
}

async function offerId(): Promise<string> {
  await container.jobs.upsert(
    makeOffer({
      title: 'Backend Java',
      company: 'Empresa X',
      skills: jobSkills(['Java', 'Spring Boot', 'Kubernetes'], ['Docker']),
      languageRequirements: [{ name: 'English', level: 'B2' }],
    }),
    new Date('2026-02-28T00:00:00Z'),
  );
  const [job] = await container.jobs.findActive();
  return job!.id;
}

describe('GET /api/cvs/:cvId/adaptations/:jobId', () => {
  it('returns an adapted draft built only from the CV, plus suggestions', async () => {
    const cvId = await processedCv();
    const jobId = await offerId();

    const res = await request(app).get(`/api/cvs/${cvId}/adaptations/${jobId}`);
    expect(res.status).toBe(200);
    const { job, document, suggestions } = res.body.data;

    expect(job).toEqual({ id: jobId, title: 'Backend Java', company: 'Empresa X' });
    expect(document.personal).toMatchObject({ fullName: '', email: '', phone: '', links: [] });
    expect(document.personal.headline).toBe('Desarrolladora Backend Semi Senior');
    expect(document.summary).toContain('años de experiencia en');
    // Matching technologies first and highlighted; the missing one is not added.
    expect(document.skills.slice(0, 3)).toEqual([
      { name: 'Java', highlighted: true },
      { name: 'Spring Boot', highlighted: true },
      { name: 'Docker', highlighted: true },
    ]);
    expect(document.skills.map((s: { name: string }) => s.name)).not.toContain('Kubernetes');
    expect(document.experiences[0]).toMatchObject({ company: 'Acme S.A.', relevant: true });
    expect(suggestions).toContainEqual({
      type: 'MISSING_REQUIRED_SKILL',
      skill: 'Kubernetes',
      message: 'La oferta pide Kubernetes. Si tenés experiencia, agregala.',
    });
  });

  it('answers 409 while the CV is not processed', async () => {
    const cv = makeCv({ processingStatus: 'FAILED' });
    await new PgCvRepository(pool).create(cv);
    const jobId = await offerId();
    const res = await request(app).get(`/api/cvs/${cv.id}/adaptations/${jobId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CV_NOT_PROCESSED');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    const cvId = await processedCv();
    const jobId = await offerId();
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect(
      (await request(app).get(`/api/cvs/${unknown}/adaptations/${jobId}`)).body.error.code,
    ).toBe('CV_NOT_FOUND');
    expect(
      (await request(app).get(`/api/cvs/${cvId}/adaptations/${unknown}`)).body.error.code,
    ).toBe('JOB_NOT_FOUND');
    const malformed = await request(app).get(`/api/cvs/${cvId}/adaptations/not-a-uuid`);
    expect(malformed.status).toBe(404);
  });
});
