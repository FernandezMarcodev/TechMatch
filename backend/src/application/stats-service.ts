import type { JobSource, Modality, Seniority } from '../domain/enums.js';
import type { Clock } from './ports.js';

/** Raw aggregates over the active offers, as the database computes them. */
export interface OfferAggregates {
  readonly offers: number;
  readonly companies: number;
  readonly remote: number;
  readonly english: number;
  readonly topSkills: readonly { name: string; count: number }[];
  readonly seniority: readonly {
    level: Seniority;
    count: number;
    avgExperienceYears: number | null;
  }[];
  readonly modality: readonly { modality: Modality; count: number }[];
  readonly sources: readonly { source: JobSource; count: number }[];
  readonly topCompanies: readonly { name: string; count: number }[];
}

/** Port: the SQL aggregations live in persistence (docs/18-PANEL-DE-TENDENCIAS.md). */
export interface OfferStatsRepository {
  aggregate(limits: { topSkills: number; topCompanies: number }): Promise<OfferAggregates>;
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
  readonly seniority: OfferAggregates['seniority'];
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
    const a = await this.repository.aggregate({
      topSkills: this.options.topSkills,
      topCompanies: this.options.topCompanies,
    });
    this.cached = {
      generatedAt: now,
      totals: {
        offers: a.offers,
        companies: a.companies,
        remotePercent: percent(a.remote, a.offers),
        englishPercent: percent(a.english, a.offers),
      },
      topSkills: a.topSkills.map((s) => ({ ...s, percent: percent(s.count, a.offers) })),
      seniority: a.seniority,
      modality: a.modality,
      sources: a.sources,
      topCompanies: a.topCompanies,
    };
    return this.cached;
  }
}
