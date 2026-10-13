import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { MemoryEmailSender } from '../src/infrastructure/email/memory-email-sender.js';
import { createContainer, type Container } from '../src/main/container.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { jobSkills, makeCv, makeOffer } from './fixtures.js';
import { createSession, createTestPool, testLogger, truncateAll } from './helpers.js';
import { SAMPLE_CV_LINES, makePdf } from './support/make-pdf.js';

const pool = createTestPool();
const NOW = new Date('2026-03-01T00:00:00Z');
let storageDir: string;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-saved-'));
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
    },
    frontendUrl: 'http://techmatch.test',
    emailSender: new MemoryEmailSender(),
    clock: { now: () => NOW },
  });
  app = createApp({
    logger: testLogger,
    corsOrigin: '*',
    routes: createRoutes({
      cvService: container.cvService,
      queries: container.queries,
      adaptation: container.adaptation,
      auth: container.auth,
      maxUploadBytes: 1_000_000,
      anonymousRecommendationsLimit: 3,
    }),
  });
});

let owner: string;
let other: string;

beforeEach(async () => {
  await truncateAll(pool);
  owner = await createSession(pool);
  other = await createSession(pool);
});

afterAll(async () => {
  await container.runner.whenIdle();
  await pool.end();
  await rm(storageDir, { recursive: true, force: true });
});

/** Uploads and processes the sample CV against one matching offer. */
async function analyzedCv(): Promise<{ cvId: string; jobId: string }> {
  await container.jobs.upsert(
    makeOffer({ title: 'Backend Java', skills: jobSkills(['Java', 'Spring Boot', 'PostgreSQL']) }),
    NOW,
  );
  const [job] = await container.jobs.findActive();
  const res = await request(app)
    .post('/api/cvs')
    .attach('file', makePdf(SAMPLE_CV_LINES), 'mi-cv.pdf');
  await container.runner.whenIdle();
  return { cvId: res.body.data.cvId as string, jobId: job!.id };
}

const save = (cvId: string, session?: string) => {
  const req = request(app).post(`/api/cvs/${cvId}/save`);
  return session ? req.set('Authorization', session) : req;
};
const myCvs = (session: string) => request(app).get('/api/me/cvs').set('Authorization', session);
const recommendations = (cvId: string, session: string) =>
  request(app).get(`/api/recommendations/${cvId}`).set('Authorization', session);

describe('saving a CV is the choice of the user', () => {
  it('is unsaved by default and saved only when the user asks', async () => {
    const { cvId } = await analyzedCv();
    expect((await myCvs(owner)).body.data.cvs).toEqual([]);
    expect((await recommendations(cvId, owner)).body.data.saved).toBe(false);

    const res = await save(cvId, owner);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: cvId, saved: true });

    expect((await recommendations(cvId, owner)).body.data.saved).toBe(true);
    expect((await myCvs(owner)).body.data.cvs).toEqual([
      {
        id: cvId,
        originalFilename: 'mi-cv.pdf',
        createdAt: NOW.toISOString(),
        savedAt: NOW.toISOString(),
        recommendationCount: 1,
      },
    ]);
  });

  it('needs a session and a processed CV, and saving twice changes nothing', async () => {
    const { cvId } = await analyzedCv();
    expect((await save(cvId)).status).toBe(401);
    expect((await save(cvId, owner)).status).toBe(200);
    expect((await save(cvId, owner)).status).toBe(200);
    expect((await myCvs(owner)).body.data.cvs).toHaveLength(1);

    const pending = makeCv({ processingStatus: 'PROCESSING' });
    await new PgCvRepository(pool).create(pending);
    expect((await save(pending.id, owner)).body.error.code).toBe('CV_NOT_PROCESSED');
  });
});

describe('a saved CV is visible only to its owner', () => {
  it('answers "not found" to anyone else, even with the link', async () => {
    const { cvId, jobId } = await analyzedCv();
    await save(cvId, owner);

    // Another account and a visitor without a session.
    expect((await request(app).get(`/api/cvs/${cvId}`).set('Authorization', other)).status).toBe(
      404,
    );
    expect((await request(app).get(`/api/cvs/${cvId}`)).status).toBe(404);
    expect((await recommendations(cvId, other)).status).toBe(404);
    expect((await request(app).get(`/api/recommendations/${cvId}`)).status).toBe(404);
    const adaptation = await request(app)
      .get(`/api/cvs/${cvId}/adaptations/${jobId}`)
      .set('Authorization', other);
    expect(adaptation.body.error.code).toBe('CV_NOT_FOUND');
    expect((await save(cvId, other)).status).toBe(404);
    expect((await myCvs(other)).body.data.cvs).toEqual([]);

    // The owner still has everything.
    expect((await request(app).get(`/api/cvs/${cvId}`).set('Authorization', owner)).status).toBe(
      200,
    );
    expect((await recommendations(cvId, owner)).status).toBe(200);
    const ownAdaptation = await request(app)
      .get(`/api/cvs/${cvId}/adaptations/${jobId}`)
      .set('Authorization', owner);
    expect(ownAdaptation.status).toBe(200);
  });
});

describe('deleting', () => {
  it('deletes a saved CV right away, only for its owner', async () => {
    const { cvId } = await analyzedCv();
    await save(cvId, owner);
    const remove = (session: string) =>
      request(app).delete(`/api/cvs/${cvId}`).set('Authorization', session);

    expect((await remove(other)).status).toBe(404);
    expect((await remove(owner)).status).toBe(204);
    expect((await myCvs(owner)).body.data.cvs).toEqual([]);
    expect(await new PgCvRepository(pool).findById(cvId)).toBeNull();
    const { rows } = await pool.query('SELECT 1 FROM match_results WHERE cv_id = $1', [cvId]);
    expect(rows).toEqual([]);
  });

  it('keeps saved CVs out of the automatic cleanup of old CVs', async () => {
    const { cvId: savedId } = await analyzedCv();
    const { cvId: unsavedId } = await analyzedCv();
    await save(savedId, owner);
    // A negative retention makes every CV "old" for this check.
    expect(await container.cvService.purgeExpired(-1)).toBe(1);
    const cvs = new PgCvRepository(pool);
    expect(await cvs.findById(savedId)).not.toBeNull();
    expect(await cvs.findById(unsavedId)).toBeNull();
  });

  it('deletes the account with its saved CVs after confirming the password', async () => {
    const { cvId } = await analyzedCv();
    await save(cvId, owner);
    const removeAccount = (password?: string) =>
      request(app).delete('/api/auth/account').set('Authorization', owner).send({ password });

    const wrong = await removeAccount('otra-clave');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe('La contraseña no es correcta.');
    expect((await removeAccount()).status).toBe(400);

    expect((await removeAccount('clave-segura-123')).status).toBe(204);
    expect((await request(app).get('/api/auth/me').set('Authorization', owner)).status).toBe(401);
    expect(await new PgCvRepository(pool).findById(cvId)).toBeNull();
    // Other accounts are untouched.
    expect((await request(app).get('/api/auth/me').set('Authorization', other)).status).toBe(200);
  });

  it('lets the browser send DELETE requests (CORS)', async () => {
    const res = await request(app).options('/api/cvs/x');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });
});
