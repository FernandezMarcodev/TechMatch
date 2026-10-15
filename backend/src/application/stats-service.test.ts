import { describe, expect, it, vi } from 'vitest';
import { StatsService, type OfferAggregates } from './stats-service.js';

const AGGREGATES: OfferAggregates = {
  offers: 8,
  companies: 3,
  remote: 3,
  english: 2,
  skills: [
    { name: 'Java', count: 4 },
    { name: 'Spring Boot', count: 3 },
    { name: 'React', count: 1 },
    { name: 'Software Architecture', count: 1 },
  ],
  seniority: [{ level: 'SENIOR', count: 5, avgExperienceYears: 4.5, english: 2 }],
  modality: [{ modality: 'REMOTE', count: 3 }],
  sources: [{ source: 'getonboard', count: 8 }],
  topCompanies: [{ name: 'Empresa X', count: 5 }],
};

function service(aggregates: OfferAggregates, now: { value: Date }) {
  const aggregate = vi.fn().mockResolvedValue(aggregates);
  const stats = new StatsService(
    { aggregate },
    { now: () => now.value },
    {
      cacheMinutes: 60,
      topSkills: 2,
      topCompanies: 10,
    },
  );
  return { stats, aggregate };
}

describe('StatsService', () => {
  it('turns counts into rounded percentages of the active offers', async () => {
    const { stats, aggregate } = service(AGGREGATES, { value: new Date('2026-10-14T12:00:00Z') });
    const result = await stats.getOfferStats();
    expect(result.totals).toEqual({
      offers: 8,
      companies: 3,
      remotePercent: 38,
      englishPercent: 25,
    });
    // STATS_TOP_SKILLS limits the ranking.
    expect(result.topSkills).toEqual([
      { name: 'Java', count: 4, percent: 50 },
      { name: 'Spring Boot', count: 3, percent: 38 },
    ]);
    expect(result.seniority).toEqual([
      { level: 'SENIOR', count: 5, avgExperienceYears: 4.5, englishPercent: 40 },
    ]);
    expect(aggregate).toHaveBeenCalledWith({ topCompanies: 10 });
  });

  it('groups the required technologies by area, leaving out skills outside the catalog', async () => {
    const { stats } = service(AGGREGATES, { value: new Date() });
    expect((await stats.getOfferStats()).skillAreas).toEqual([
      { area: 'LANGUAGES', count: 4, percent: 50 },
      { area: 'BACKEND', count: 3, percent: 38 },
      { area: 'FRONTEND', count: 1, percent: 13 },
    ]);
  });

  it('gives the demand of every catalog technology, for "Qué te falta"', async () => {
    const { stats } = service(AGGREGATES, { value: new Date() });
    expect(await stats.requiredSkills()).toEqual([
      { name: 'Java', percent: 50 },
      { name: 'Spring Boot', percent: 38 },
      { name: 'React', percent: 13 },
    ]);
  });

  it('answers 0% instead of dividing by zero when there are no offers', async () => {
    const empty = { ...AGGREGATES, offers: 0, remote: 0, english: 0, skills: [], seniority: [] };
    const { stats } = service(empty, { value: new Date() });
    expect((await stats.getOfferStats()).totals).toMatchObject({
      remotePercent: 0,
      englishPercent: 0,
    });
  });

  it('reuses the result for STATS_CACHE_MINUTES and then recomputes it', async () => {
    const now = { value: new Date('2026-10-14T12:00:00Z') };
    const { stats, aggregate } = service(AGGREGATES, now);
    await stats.getOfferStats();
    now.value = new Date('2026-10-14T12:59:00Z');
    await stats.getOfferStats();
    expect(aggregate).toHaveBeenCalledTimes(1);
    now.value = new Date('2026-10-14T13:00:00Z');
    expect((await stats.getOfferStats()).generatedAt).toEqual(now.value);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });
});
