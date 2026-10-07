import type { MatchResultRepository, Recommendation } from '../application/ports.js';
import type { MatchCriterion, MatchReason, MatchResult } from '../domain/entities.js';
import type { MatchLevel } from '../domain/enums.js';
import { withTransaction, type DbPool } from '../infrastructure/db/pool.js';
import {
  JOB_OFFER_COLUMNS,
  loadJobSkills,
  toJobOffer,
  type JobOfferRow,
} from './pg-job-offer-repository.js';

interface RecommendationRow extends JobOfferRow {
  match_id: string;
  match_cv_id: string;
  match_score: string;
  match_level: MatchLevel;
  criteria_json: MatchCriterion[];
  reasons_json: MatchReason[];
  calculated_at: Date;
}

export class PgMatchResultRepository implements MatchResultRepository {
  constructor(private readonly pool: DbPool) {}

  async replaceForCv(cvId: string, results: readonly MatchResult[]): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await client.query('DELETE FROM match_results WHERE cv_id = $1', [cvId]);
      if (results.length === 0) return;
      const payload = results.map((r) => ({
        id: r.id,
        cv_id: r.cvId,
        job_offer_id: r.jobOfferId,
        score: r.score,
        level: r.level,
        criteria_json: r.criteria,
        reasons_json: r.reasons,
        calculated_at: r.calculatedAt.toISOString(),
      }));
      await client.query(
        `INSERT INTO match_results (id, cv_id, job_offer_id, score, level, criteria_json,
                                    reasons_json, calculated_at)
         SELECT id, cv_id, job_offer_id, score, level, criteria_json, reasons_json, calculated_at
         FROM jsonb_to_recordset($1::jsonb) AS x(id uuid, cv_id uuid, job_offer_id uuid,
           score numeric, level varchar, criteria_json jsonb, reasons_json jsonb,
           calculated_at timestamptz)`,
        [JSON.stringify(payload)],
      );
    });
  }

  async findRecommendations(cvId: string): Promise<Recommendation[]> {
    const { rows } = await this.pool.query<RecommendationRow>(
      `SELECT ${JOB_OFFER_COLUMNS}, mr.id AS match_id, mr.cv_id AS match_cv_id,
              mr.score AS match_score, mr.level AS match_level, mr.criteria_json,
              mr.reasons_json, mr.calculated_at
       FROM match_results mr JOIN job_offers jo ON jo.id = mr.job_offer_id
       WHERE mr.cv_id = $1 AND mr.level IN ('MEDIUM', 'HIGH') AND jo.is_active
       ORDER BY mr.score DESC, jo.id`,
      [cvId],
    );
    const skills = await loadJobSkills(
      this.pool,
      rows.map((r) => r.id),
    );
    return rows.map((row) => ({
      job: toJobOffer(row, skills.get(row.id) ?? []),
      match: {
        id: row.match_id,
        cvId: row.match_cv_id,
        jobOfferId: row.id,
        score: Number(row.match_score),
        level: row.match_level,
        criteria: row.criteria_json,
        reasons: row.reasons_json,
        calculatedAt: row.calculated_at,
      },
    }));
  }
}
