import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryEmailSender } from '../src/infrastructure/email/memory-email-sender.js';
import { createContainer, type Container } from '../src/main/container.js';
import { PgCandidateProfileRepository } from '../src/persistence/pg-candidate-profile-repository.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { makeCv, makeProfile } from './fixtures.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';

const NOW = new Date('2026-03-31T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const pool = createTestPool();
const cvs = new PgCvRepository(pool);
const profiles = new PgCandidateProfileRepository(pool);
let storageDir: string;
let container: Container;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-retention-'));
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
      STATS_CACHE_MINUTES: 60,
      STATS_TOP_SKILLS: 15,
      STATS_TOP_COMPANIES: 10,
      MISSING_SKILLS_LIMIT: 5,
    },
    frontendUrl: 'http://techmatch.test',
    emailSender: new MemoryEmailSender(),
    clock: { now: () => NOW },
  });
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
  await rm(storageDir, { recursive: true, force: true });
});

describe('retention of CVs', () => {
  it('deletes CVs older than the retention period with their profile', async () => {
    const old = makeCv({ processingStatus: 'PROCESSED', createdAt: daysAgo(31) });
    const recent = makeCv({ processingStatus: 'PROCESSED', createdAt: daysAgo(29) });
    for (const cv of [old, recent]) {
      await cvs.create(cv);
      await profiles.save(makeProfile(cv.id));
    }

    expect(await container.cvService.purgeExpired(30)).toBe(1);

    expect(await cvs.findById(old.id)).toBeNull();
    expect(await profiles.findByCvId(old.id)).toBeNull();
    expect(await cvs.findById(recent.id)).not.toBeNull();
    expect(await profiles.findByCvId(recent.id)).not.toBeNull();
  });

  it('is a no-op when no CV has expired', async () => {
    await cvs.create(makeCv({ createdAt: daysAgo(1) }));
    expect(await container.cvService.purgeExpired(30)).toBe(0);
  });
});
