import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { createContainer, type Container } from '../src/main/container.js';
import { jobSkills, makeOffer } from './fixtures.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';
import { SAMPLE_CV_LINES, makePdf } from './support/make-pdf.js';

const pool = createTestPool();
const MAX_BYTES = 200_000;
let storageDir: string;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-cvs-'));
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: MAX_BYTES,
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
      maxUploadBytes: MAX_BYTES,
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

async function seedJobs() {
  const seenAt = new Date('2026-02-28T00:00:00Z');
  const jobs = container.jobs;
  // HIGH: matches the sample CV closely.
  await jobs.upsert(
    makeOffer({
      title: 'Backend Java Semi Senior',
      skills: jobSkills(['Java', 'Spring Boot', 'PostgreSQL'], ['Docker']),
      experienceYearsMin: 3,
    }),
    seenAt,
  );
  // MEDIUM: half the skills, different seniority, less experience than required.
  await jobs.upsert(
    makeOffer({
      title: 'Desarrollador Fullstack Senior',
      skills: jobSkills(['Java', 'Docker', 'React', 'Angular']),
      seniority: 'SENIOR',
      experienceYearsMin: 10,
    }),
    seenAt,
  );
  // LOW: unrelated stack, onsite elsewhere.
  await jobs.upsert(
    makeOffer({
      title: 'iOS Developer',
      skills: jobSkills(['Swift', 'Kotlin']),
      seniority: 'LEAD',
      modality: 'ONSITE',
      location: 'Córdoba, Córdoba',
      experienceYearsMin: 10,
    }),
    seenAt,
  );
}

async function uploadAndProcess(pdf: Buffer) {
  const res = await request(app).post('/api/cvs').attach('file', pdf, 'mi-cv.pdf');
  await container.runner.whenIdle();
  return res;
}

describe('primary flow: upload → processing → recommendations → job detail', () => {
  it('works end to end without authentication', async () => {
    await seedJobs();

    const upload = await uploadAndProcess(makePdf(SAMPLE_CV_LINES));
    expect(upload.status).toBe(201);
    expect(upload.body).toEqual({ data: { cvId: expect.any(String), status: 'processing' } });
    const { cvId } = upload.body.data;

    const status = await request(app).get(`/api/cvs/${cvId}`);
    expect(status.body).toEqual({ data: { id: cvId, status: 'processed' } });

    const recs = await request(app).get(`/api/recommendations/${cvId}`);
    expect(recs.status).toBe(200);
    const list = recs.body.data.recommendations;
    expect(list.map((r: { job: { title: string } }) => r.job.title)).toEqual([
      'Backend Java Semi Senior',
      'Desarrollador Fullstack Senior',
    ]);
    expect(list.map((r: { match: { level: string } }) => r.match.level)).toEqual([
      'HIGH',
      'MEDIUM',
    ]);
    const [first] = list;
    // The numeric score is internal: only the level reaches the user.
    expect(first.match).not.toHaveProperty('score');
    expect(first.job).toMatchObject({
      company: 'Empresa X',
      modality: 'HYBRID',
      source: 'getonboard',
      sourceUrl: expect.stringMatching(/^https:\/\//),
    });
    expect(first.match.reasons).toContainEqual({
      criterion: 'skills',
      status: 'positive',
      message: expect.stringContaining('tecnologías requeridas'),
    });

    const detail = await request(app).get(`/api/jobs/${first.job.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: first.job.id,
      title: 'Backend Java Semi Senior',
      requirements: ['Java', 'Spring', '2 años de experiencia'],
      skills: expect.arrayContaining(['Java', 'PostgreSQL']),
      source: { name: 'getonboard', url: first.job.sourceUrl },
      isActive: true,
    });
    // Persistence entities are not leaked.
    expect(detail.body.data).not.toHaveProperty('firstSeenAt');
    expect(detail.body.data).not.toHaveProperty('externalId');
  });

  it('accepts a second CV in the same session', async () => {
    const a = await uploadAndProcess(makePdf(SAMPLE_CV_LINES));
    const b = await uploadAndProcess(makePdf(SAMPLE_CV_LINES));
    expect(a.body.data.cvId).not.toBe(b.body.data.cvId);
  });

  it('stores the file privately under a generated name', async () => {
    await uploadAndProcess(makePdf(SAMPLE_CV_LINES));
    const files = await readdir(storageDir);
    expect(files.every((f) => /^[0-9a-f-]{36}\.pdf$/.test(f))).toBe(true);
  });

  it('marks scanned/empty PDFs as failed', async () => {
    const upload = await uploadAndProcess(makePdf([]));
    expect(upload.status).toBe(201);
    const status = await request(app).get(`/api/cvs/${upload.body.data.cvId}`);
    expect(status.body.data.status).toBe('failed');
  });
});

describe('error contract', () => {
  it('rejects non-PDF files regardless of declared type', async () => {
    const res = await request(app)
      .post('/api/cvs')
      .attach('file', Buffer.from('hola, soy un txt'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'INVALID_FILE', message: expect.any(String), details: {} },
    });
  });

  it('rejects missing file', async () => {
    const res = await request(app).post('/api/cvs');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects files over the configured limit', async () => {
    const big = Buffer.concat([makePdf(['x']), Buffer.alloc(MAX_BYTES)]);
    const res = await request(app).post('/api/cvs').attach('file', big, 'big.pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects corrupt PDFs with 422', async () => {
    const res = await request(app)
      .post('/api/cvs')
      .attach('file', Buffer.from('%PDF-1.4 broken'), 'broken.pdf');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PDF_NOT_PROCESSABLE');
  });

  it('returns 404 for unknown or malformed ids', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect((await request(app).get(`/api/cvs/${unknown}`)).body.error.code).toBe('CV_NOT_FOUND');
    expect((await request(app).get('/api/cvs/../../etc')).status).toBe(404);
    const rec = await request(app).get('/api/recommendations/not-a-uuid');
    expect(rec.status).toBe(404);
    expect(rec.body.error.code).toBe('CV_NOT_FOUND');
    const job = await request(app).get(`/api/jobs/${unknown}`);
    expect(job.status).toBe(404);
    expect(job.body.error.code).toBe('JOB_NOT_FOUND');
  });
});
