import type { JobSource, Modality, Seniority } from '../domain/enums.js';
import type { SkillArea } from '../domain/normalization/skill-catalog.js';
import { skillArea } from '../domain/normalization/skills.js';
import type { Clock } from './ports.js';

/** Raw aggregates over the active offers, as the database computes them. */
export interface OfferAggregates {
  readonly offers: number;
  readonly companies: number;
  readonly remote: number;
  readonly english: number;
  /** Every required skill with the number of active offers that require it, most required first. */
  readonly skills: readonly { name: string; count: number }[];
  readonly seniority: readonly {
    level: Seniority;
    count: number;
    avgExperienceYears: number | null;
    /** Offers of this level that ask for English. */
    english: number;
  }[];
  readonly modality: readonly { modality: Modality; count: number }[];
  readonly sources: readonly { source: JobSource; count: number }[];
  readonly topCompanies: readonly { name: string; count: number }[];
}

/** Port: the SQL aggregations live in persistence (docs/18-PANEL-DE-TENDENCIAS.md). */
export interface OfferStatsRepository {
  aggregate(limits: { topCompanies: number }): Promise<OfferAggregates>;
}

export interface OfferStats {
  readonly generatedAt: Date;
  readonly totals: {
    offers: number;
    companies: number;
    remotePercent: number;
    englishPercent: number;
  };
  readonly topSkills: readonly { name: string; count: number; percent: number }[];
  /** Share of each area among the required technologies the catalog recognizes. */
  readonly skillAreas: readonly { area: SkillArea; count: number; percent: number }[];
  readonly seniority: readonly {
    level: Seniority;
    count: number;
    avgExperienceYears: number | null;
    englishPercent: number;
  }[];
  readonly modality: OfferAggregates['modality'];
  readonly sources: OfferAggregates['sources'];
  readonly topCompanies: OfferAggregates['topCompanies'];
}

export interface StatsServiceOptions {
  readonly cacheMinutes: number;
  readonly topSkills: number;
  readonly topCompanies: number;
}

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Required-skill mentions grouped by catalog area. Skills outside the catalog (generic
 * tags such as "Software Architecture") have no area and are left out.
 */
function byArea(skills: OfferAggregates['skills']): OfferStats['skillAreas'] {
  const counts = new Map<SkillArea, number>();
  for (const skill of skills) {
    const area = skillArea(skill.name);
    if (area) counts.set(area, (counts.get(area) ?? 0) + skill.count);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return [...counts]
    .map(([area, count]) => ({ area, count, percent: percent(count, total) }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

/**
 * Market trends over the active offers, for the public dashboard. No user or CV data.
 * Offers change every 12 h, so the result is cached for `cacheMinutes`.
 */
export class StatsService {
  private cached: OfferStats | undefined;

  constructor(
    private readonly repository: OfferStatsRepository,
    private readonly clock: Clock,
    private readonly options: StatsServiceOptions,
  ) {}

  async getOfferStats(): Promise<OfferStats> {
    const now = this.clock.now();
    const maxAgeMs = this.options.cacheMinutes * 60_000;
    if (this.cached && now.getTime() - this.cached.generatedAt.getTime() < maxAgeMs) {
      return this.cached;
    }
    const a = await this.repository.aggregate({ topCompanies: this.options.topCompanies });
    this.cached = {
      generatedAt: now,
      totals: {
        offers: a.offers,
        companies: a.companies,
        remotePercent: percent(a.remote, a.offers),
        englishPercent: percent(a.english, a.offers),
      },
      topSkills: a.skills
        .slice(0, this.options.topSkills)
        .map((s) => ({ ...s, percent: percent(s.count, a.offers) })),
      skillAreas: byArea(a.skills),
      seniority: a.seniority.map(({ english, ...level }) => ({
        ...level,
        englishPercent: percent(english, level.count),
      })),
      modality: a.modality,
      sources: a.sources,
      topCompanies: a.topCompanies,
    };
    return this.cached;
  }
}
