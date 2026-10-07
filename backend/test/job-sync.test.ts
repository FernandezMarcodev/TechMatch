import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mapGetOnBoardJob } from '../src/job-sources/connectors/getonboard.js';
import { JobSyncService } from '../src/job-sources/sync-service.js';
import type { JobSourceConnector, RawJobOffer } from '../src/job-sources/types.js';
import { PgJobOfferRepository } from '../src/persistence/pg-job-offer-repository.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';
import { HYBRID_JOB, REMOTE_JOB } from './support/getonboard-fixture.js';

const pool = createTestPool();
const jobs = new PgJobOfferRepository(pool);

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

function sync(batch: RawJobOffer[], at: Date) {
  const connector: JobSourceConnector = {
    source: 'getonboard',
    fetchOffers: () => Promise.resolve(batch),
  };
  return new JobSyncService([connector], jobs, { now: () => at }, testLogger).syncAll();
}

describe('job sync pipeline with persistence', () => {
  it('inserts, updates, deactivates and reactivates offers across syncs', async () => {
    const t1 = new Date('2026-10-01T00:00:00Z');
    const t2 = new Date('2026-10-01T12:00:00Z');
    const t3 = new Date('2026-10-02T00:00:00Z');
    const hybrid = mapGetOnBoardJob(HYBRID_JOB, t1);
    const remote = mapGetOnBoardJob(REMOTE_JOB, t1);

    const [first] = await sync([hybrid, remote], t1);
    expect(first).toMatchObject({ inserted: 2, updated: 0, deactivated: 0 });

    const stored = await jobs.findActive();
    const java = stored.find((j) => j.externalId === HYBRID_JOB.id);
    expect(java).toMatchObject({
      title: 'Backend Java Developer',
      company: 'Acme',
      location: 'Buenos Aires, Argentina',
      modality: 'HYBRID',
      seniority: 'SEMI_SENIOR',
      experienceYearsMin: 3,
      languageRequirements: [{ name: 'English', level: 'B1' }],
    });
    expect(java?.skills.filter((s) => !s.isRequired).map((s) => s.name)).toEqual([
      'Docker',
      'Kubernetes',
    ]);

    // The remote offer disappears: it is marked inactive, not deleted.
    const [second] = await sync([hybrid], t2);
    expect(second).toMatchObject({ inserted: 0, updated: 1, deactivated: 1 });
    expect((await jobs.findActive()).map((j) => j.externalId)).toEqual([HYBRID_JOB.id]);

    // It comes back.
    const [third] = await sync([hybrid, remote], t3);
    expect(third).toMatchObject({ updated: 2, deactivated: 0 });
    expect(await jobs.findActive()).toHaveLength(2);
  });
});
