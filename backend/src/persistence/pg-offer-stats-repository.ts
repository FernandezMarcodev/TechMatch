import type { OfferAggregates, OfferStatsRepository } from '../application/stats-service.js';
import type { JobSource, Modality, Seniority } from '../domain/enums.js';
import type { Queryable } from '../infrastructure/db/pool.js';
import { UNKNOWN_COMPANY } from '../job-sources/normalizer.js';

// Seniority from the most junior up, for a readable chart.
const SENIORITY_ORDER = `CASE seniority WHEN 'INTERN' THEN 1 WHEN 'JUNIOR' THEN 2
  WHEN 'SEMI_SENIOR' THEN 3 WHEN 'SENIOR' THEN 4 WHEN 'LEAD' THEN 5 WHEN 'MANAGER' THEN 6 END`;

/**
 * Market trends as SQL aggregations over the active offers (COUNT, AVG, GROUP BY): the
 * database does the analysis where the data lives (docs/13-DECISIONES-TECNICAS.md).
 */
export class PgOfferStatsRepository implements OfferStatsRepository {
  constructor(private readonly db: Queryable) {}

  async aggregate(limits: { topSkills: number; topCompanies: number }): Promise<OfferAggregates> {
    const [totals, skills, seniority, modality, sources, companies] = await Promise.all([
      this.db.query<{ offers: string; companies: string; remote: string; english: string }>(
        `SELECT COUNT(*) AS offers,
                COUNT(DISTINCT company) AS companies,
                COUNT(*) FILTER (WHERE modality = 'REMOTE') AS remote,
                COUNT(*) FILTER (WHERE language_requirements @> '[{"name": "English"}]') AS english
         FROM job_offers WHERE is_active`,
      ),
      this.db.query<{ name: string; count: string }>(
        `SELECT s.name, COUNT(*) AS count
         FROM job_skills js
         JOIN skills s ON s.id = js.skill_id
         JOIN job_offers jo ON jo.id = js.job_offer_id
         WHERE jo.is_active AND js.is_required
         GROUP BY s.name
         ORDER BY count DESC, s.name
         LIMIT $1`,
        [limits.topSkills],
      ),
      this.db.query<{ level: Seniority; count: string; avg_years: string | null }>(
        `SELECT seniority AS level, COUNT(*) AS count,
                ROUND(AVG(experience_years_min), 1) AS avg_years
         FROM job_offers
         WHERE is_active AND seniority IS NOT NULL AND seniority <> 'UNKNOWN'
         GROUP BY seniority
         ORDER BY ${SENIORITY_ORDER}`,
      ),
      this.db.query<{ modality: Modality | null; count: string }>(
        `SELECT modality, COUNT(*) AS count FROM job_offers WHERE is_active
         GROUP BY modality ORDER BY count DESC`,
      ),
      this.db.query<{ source: JobSource; count: string }>(
        `SELECT source, COUNT(*) AS count FROM job_offers WHERE is_active
         GROUP BY source ORDER BY count DESC`,
      ),
      this.db.query<{ name: string; count: string }>(
        `SELECT company AS name, COUNT(*) AS count FROM job_offers
         WHERE is_active AND company <> $2
         GROUP BY company ORDER BY count DESC, company LIMIT $1`,
        [limits.topCompanies, UNKNOWN_COMPANY],
      ),
    ]);
    const t = totals.rows[0];
    return {
      offers: Number(t?.offers ?? 0),
      companies: Number(t?.companies ?? 0),
      remote: Number(t?.remote ?? 0),
      english: Number(t?.english ?? 0),
      topSkills: skills.rows.map((r) => ({ name: r.name, count: Number(r.count) })),
      seniority: seniority.rows.map((r) => ({
        level: r.level,
        count: Number(r.count),
        avgExperienceYears: r.avg_years === null ? null : Number(r.avg_years),
      })),
      modality: modality.rows.map((r) => ({
        modality: r.modality ?? 'UNKNOWN',
        count: Number(r.count),
      })),
      sources: sources.rows.map((r) => ({ source: r.source, count: Number(r.count) })),
      topCompanies: companies.rows.map((r) => ({ name: r.name, count: Number(r.count) })),
    };
  }
}
