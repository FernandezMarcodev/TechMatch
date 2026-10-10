import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { MatchResult } from '../src/domain/entities.js';
import type { MatchLevel } from '../src/domain/enums.js';
import { PgCandidateProfileRepository } from '../src/persistence/pg-candidate-profile-repository.js';
import { PgCvRepository } from '../src/persistence/pg-cv-repository.js';
import { PgJobOfferRepository } from '../src/persistence/pg-job-offer-repository.js';
import { PgMatchResultRepository } from '../src/persistence/pg-match-result-repository.js';
import { jobSkills, makeCv, makeOffer, makeProfile } from './fixtures.js';
import { createTestPool, truncateAll } from './helpers.js';

const pool = createTestPool();
const cvs = new PgCvRepository(pool);
const profiles = new PgCandidateProfileRepository(pool);
const jobs = new PgJobOfferRepository(pool);
const matches = new PgMatchResultRepository(pool);

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PgCvRepository', () => {
  it('creates, reads and updates status', async () => {
    const cv = makeCv();
    await cvs.create(cv);
    expect((await cvs.findById(cv.id))?.processingStatus).toBe('UPLOADED');

    await cvs.updateStatus(cv.id, 'PROCESSED', 'texto');
    const updated = await cvs.findById(cv.id);
    expect(updated?.processingStatus).toBe('PROCESSED');
    expect(updated?.extractedText).toBe('texto');
  });

  it('returns null for unknown ids', async () => {
    expect(await cvs.findById(randomUUID())).toBeNull();
  });
});

describe('PgCandidateProfileRepository', () => {
  it('round-trips a profile with its children', async () => {
    const cv = makeCv();
    await cvs.create(cv);
    const projects = [
      { name: 'TechMatch', description: 'API REST.', startDate: '2024-01-01', endDate: null },
      { name: 'Bot', description: null, startDate: null, endDate: null },
    ];
    const profile = makeProfile(cv.id, { projects });
    await profiles.save(profile);

    const loaded = await profiles.findByCvId(cv.id);
    expect(loaded).toMatchObject({
      id: profile.id,
      seniority: 'SEMI_SENIOR',
      totalExperienceYears: 3,
      location: 'CABA',
      languages: [{ name: 'English', level: 'B2' }],
    });
    expect(loaded?.skills.map((s) => s.name)).toEqual(['Java', 'Spring', 'SQL']);
    expect(loaded?.experiences[0]).toMatchObject({ company: 'Acme', startDate: '2022-03-01' });
    expect(loaded?.education[0]?.level).toBe('UNIVERSITY');
    // Projects keep the CV's order.
    expect(loaded?.projects).toEqual(projects);
  });

  it('does not duplicate shared skills across profiles', async () => {
    for (let i = 0; i < 2; i++) {
      const cv = makeCv();
      await cvs.create(cv);
      await profiles.save(makeProfile(cv.id));
    }
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM skills');
    expect(rows[0].n).toBe(3);
  });
});

describe('PgJobOfferRepository', () => {
  const t1 = new Date('2026-01-01T00:00:00Z');
  const t2 = new Date('2026-01-01T12:00:00Z');

  it('inserts then updates the same offer by externalId', async () => {
    const offer = makeOffer();
    expect(await jobs.upsert(offer, t1)).toBe('inserted');
    expect(await jobs.upsert({ ...offer, title: 'Nuevo título' }, t2)).toBe('updated');

    const active = await jobs.findActive();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ title: 'Nuevo título', firstSeenAt: t1, lastSeenAt: t2 });
    expect(active[0]?.requirements).toEqual(['Java', 'Spring', '2 años de experiencia']);
  });

  it('deduplicates by URL when there is no externalId', async () => {
    const offer = makeOffer({ externalId: null });
    await jobs.upsert(offer, t1);
    expect(await jobs.upsert({ ...offer, description: 'otra' }, t2)).toBe('updated');
    expect(await jobs.findActive()).toHaveLength(1);
  });

  it('deduplicates by source + title + company + location as last resort', async () => {
    const offer = makeOffer({ externalId: null });
    await jobs.upsert(offer, t1);
    const outcome = await jobs.upsert(
      { ...offer, sourceUrl: 'https://example.com/otra-url', title: offer.title.toUpperCase() },
      t2,
    );
    expect(outcome).toBe('updated');
  });

  it('keeps job skills with the required flag', async () => {
    await jobs.upsert(makeOffer({ skills: jobSkills(['Java'], ['Docker']) }), t1);
    const [job] = await jobs.findActive();
    expect(job?.skills).toEqual([
      { name: 'Java', normalizedName: 'java', isRequired: true },
      { name: 'Docker', normalizedName: 'docker', isRequired: false },
    ]);
  });

  it('marks unseen offers of the same source inactive without deleting them', async () => {
    const old = makeOffer();
    const fresh = makeOffer();
    const other = makeOffer();
    await jobs.upsert(old, t1);
    await jobs.upsert(other, t1);
    await jobs.upsert(fresh, t2);
    // Simulate an offer from a second source (only one source exists today).
    await pool.query(`UPDATE job_offers SET source = 'another-source' WHERE external_id = $1`, [
      other.externalId,
    ]);

    expect(await jobs.markUnseenInactive('getonboard', t2)).toBe(1);
    const active = await jobs.findActive();
    expect(active.map((j) => j.externalId).sort()).toEqual(
      [fresh.externalId, other.externalId].sort(),
    );
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM job_offers');
    expect(rows[0].n).toBe(3);

    // Seen again -> active again.
    await jobs.upsert(old, new Date('2026-01-02T00:00:00Z'));
    expect(await jobs.findActive()).toHaveLength(3);
  });
});

describe('PgMatchResultRepository', () => {
  async function seed(levels: [number, MatchLevel][]) {
    const cv = makeCv();
    await cvs.create(cv);
    const results: MatchResult[] = [];
    for (let i = 0; i < levels.length; i++) {
      await jobs.upsert(makeOffer(), new Date());
    }
    const all = await jobs.findActive();
    levels.forEach(([score, level], i) => {
      results.push({
        id: randomUUID(),
        cvId: cv.id,
        jobOfferId: all[i]!.id,
        score,
        level,
        criteria: [],
        reasons: [{ criterion: 'skills', status: 'positive', message: 'ok' }],
        calculatedAt: new Date(),
      });
    });
    await matches.replaceForCv(cv.id, results);
    return { cv, results };
  }

  it('returns only MEDIUM/HIGH, ordered by score desc', async () => {
    const { cv } = await seed([
      [60, 'MEDIUM'],
      [30, 'LOW'],
      [90, 'HIGH'],
    ]);
    const recs = await matches.findRecommendations(cv.id);
    expect(recs.map((r) => r.match.score)).toEqual([90, 60]);
    expect(recs[0]?.match.reasons).toEqual([
      { criterion: 'skills', status: 'positive', message: 'ok' },
    ]);
    expect(recs[0]?.job.skills.length).toBeGreaterThan(0);
  });

  it('excludes inactive offers', async () => {
    const { cv, results } = await seed([[80, 'HIGH']]);
    await pool.query('UPDATE job_offers SET is_active = false WHERE id = $1', [
      results[0]!.jobOfferId,
    ]);
    expect(await matches.findRecommendations(cv.id)).toEqual([]);
  });

  it('replaces previous results for the CV', async () => {
    const { cv, results } = await seed([[80, 'HIGH']]);
    await matches.replaceForCv(cv.id, [
      { ...results[0]!, id: randomUUID(), score: 55, level: 'MEDIUM' },
    ]);
    const recs = await matches.findRecommendations(cv.id);
    expect(recs.map((r) => r.match.score)).toEqual([55]);
  });
});
