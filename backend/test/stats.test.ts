import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { MemoryEmailSender } from '../src/infrastructure/email/memory-email-sender.js';
import { createContainer, type Container } from '../src/main/container.js';
import { jobSkills, makeOffer } from './fixtures.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';

const pool = createTestPool();
const SEEN = new Date('2026-10-01T00:00:00Z');
let container: Container;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: 1_000_000,
      CV_STORAGE_DIR: './storage/test-stats',
      CV_MIN_TEXT_CHARS: 50,
      MATCHING_CONFIG_PATH: undefined,
      SESSION_TTL_DAYS: 30,
      EMAIL_VERIFICATION_TTL_HOURS: 24,
      PASSWORD_RESET_TTL_MINUTES: 30,
      // No cache: each test reads its own data.
      STATS_CACHE_MINUTES: 0,
      STATS_TOP_SKILLS: 2,
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
  await pool.end();
});

describe('GET /api/stats/offers (public trends dashboard)', () => {
  it('aggregates the active offers, without a session', async () => {
    const jobs = container.jobs;
    const english = [{ name: 'English', level: 'B2' as const }];
    await jobs.upsert(
      makeOffer({
        company: 'Acme',
        modality: 'REMOTE',
        seniority: 'SENIOR',
        experienceYearsMin: 5,
        skills: jobSkills(['Java', 'Spring'], ['Docker']),
        languageRequirements: english,
      }),
      SEEN,
    );
    await jobs.upsert(
      makeOffer({
        company: 'Acme',
        modality: 'HYBRID',
        seniority: 'SENIOR',
        experienceYearsMin: 3,
        skills: jobSkills(['Java', 'React']),
        languageRequirements: [],
      }),
      SEEN,
    );
    await jobs.upsert(
      makeOffer({
        company: 'Empresa no especificada',
        modality: 'UNKNOWN',
        seniority: 'JUNIOR',
        experienceYearsMin: null,
        skills: jobSkills(['Java']),
        languageRequirements: [],
      }),
      SEEN,
    );
    // Inactive offers do not count.
    await jobs.upsert(
      makeOffer({ company: 'Vieja', skills: jobSkills(['COBOL']) }),
      new Date('2026-01-01T00:00:00Z'),
    );
    await jobs.markUnseenInactive('getonboard', SEEN);

    const res = await request(app).get('/api/stats/offers');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totals).toEqual({ offers: 3, companies: 2, remotePercent: 33, englishPercent: 33 });
    // Required skills only (Docker is nice-to-have), limited by STATS_TOP_SKILLS.
    expect(data.topSkills).toEqual([
      { name: 'Java', count: 3, percent: 100 },
      { name: 'React', count: 1, percent: 33 },
    ]);
    expect(data.seniority).toEqual([
      { level: 'JUNIOR', count: 1, avgExperienceYears: null },
      { level: 'SENIOR', count: 2, avgExperienceYears: 4 },
    ]);
    expect(data.modality).toEqual(
      expect.arrayContaining([
        { modality: 'REMOTE', count: 1 },
        { modality: 'HYBRID', count: 1 },
        { modality: null, count: 1 },
      ]),
    );
    expect(data.sources).toEqual([{ source: 'getonboard', count: 3 }]);
    // The placeholder for offers without a company is not a company.
    expect(data.topCompanies).toEqual([{ name: 'Acme', count: 2 }]);
    expect(Date.parse(data.generatedAt)).not.toBeNaN();
  });

  it('answers zeros when there are no offers', async () => {
    const res = await request(app).get('/api/stats/offers');
    expect(res.body.data.totals).toEqual({
      offers: 0,
      companies: 0,
      remotePercent: 0,
      englishPercent: 0,
    });
    expect(res.body.data.topSkills).toEqual([]);
  });
});
