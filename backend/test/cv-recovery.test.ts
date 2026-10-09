import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, type Container } from '../src/main/container.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { makeCv } from './fixtures.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';

const pool = createTestPool();
const cvs = new PgCvRepository(pool);
let storageDir: string;
let container: Container;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-recovery-'));
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: 1_000_000,
      CV_STORAGE_DIR: storageDir,
      CV_MIN_TEXT_CHARS: 50,
      MATCHING_CONFIG_PATH: undefined,
    },
  });
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
  await rm(storageDir, { recursive: true, force: true });
});

describe('recovery of CVs interrupted by a restart', () => {
  it('fails CVs left uploaded or processing and keeps finished ones', async () => {
    const processing = makeCv({ processingStatus: 'PROCESSING' });
    const uploaded = makeCv({ processingStatus: 'UPLOADED' });
    const processed = makeCv({ processingStatus: 'PROCESSED' });
    const failed = makeCv({ processingStatus: 'FAILED' });
    for (const cv of [processing, uploaded, processed, failed]) await cvs.create(cv);

    expect(await container.cvService.recoverInterrupted()).toBe(2);

    expect((await cvs.findById(processing.id))?.processingStatus).toBe('FAILED');
    expect((await cvs.findById(uploaded.id))?.processingStatus).toBe('FAILED');
    expect((await cvs.findById(processed.id))?.processingStatus).toBe('PROCESSED');
    expect((await cvs.findById(failed.id))?.processingStatus).toBe('FAILED');
  });

  it('is a no-op when nothing was interrupted', async () => {
    await cvs.create(makeCv({ processingStatus: 'PROCESSED' }));
    expect(await container.cvService.recoverInterrupted()).toBe(0);
  });
});
