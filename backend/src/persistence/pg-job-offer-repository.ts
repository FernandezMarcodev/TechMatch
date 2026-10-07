import { randomUUID } from 'node:crypto';
import type {
  JobOfferRepository,
  NormalizedJobOffer,
  UpsertOutcome,
} from '../application/ports.js';
import type {
  EducationRequirement,
  JobOffer,
  JobSkill,
  LanguageRequirement,
} from '../domain/entities.js';
import type { JobSource, Modality, Seniority } from '../domain/enums.js';
import {
  toNumber,
  withTransaction,
  type DbClient,
  type DbPool,
  type Queryable,
} from '../infrastructure/db/pool.js';
import { upsertSkills } from './skill-store.js';

export interface JobOfferRow {
  id: string;
  external_id: string | null;
  source: JobSource;
  source_url: string;
  title: string;
  company: string;
  location: string | null;
  modality: Modality | null;
  description: string;
  requirements: string;
  seniority: Seniority | null;
  experience_years_min: string | null;
  education_requirements: EducationRequirement | null;
  language_requirements: LanguageRequirement[];
  published_at: Date | null;
  first_seen_at: Date;
  last_seen_at: Date;
  is_active: boolean;
}

export const JOB_OFFER_COLUMNS = `jo.id, jo.external_id, jo.source, jo.source_url, jo.title, jo.company,
  jo.location, jo.modality, jo.description, jo.requirements, jo.seniority, jo.experience_years_min,
  jo.education_requirements, jo.language_requirements, jo.published_at, jo.first_seen_at,
  jo.last_seen_at, jo.is_active`;

/** Requirements are stored as newline-separated TEXT (docs/07-DATABASE.md). */
function splitRequirements(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function toJobOffer(row: JobOfferRow, skills: readonly JobSkill[]): JobOffer {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    company: row.company,
    location: row.location,
    modality: row.modality ?? 'UNKNOWN',
    description: row.description,
    requirements: splitRequirements(row.requirements),
    skills,
    seniority: row.seniority ?? 'UNKNOWN',
    experienceYearsMin: toNumber(row.experience_years_min),
    educationRequirements: row.education_requirements,
    languageRequirements: row.language_requirements,
    publishedAt: row.published_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    isActive: row.is_active,
  };
}

export async function loadJobSkills(
  db: Queryable,
  jobIds: readonly string[],
): Promise<Map<string, JobSkill[]>> {
  const byJob = new Map<string, JobSkill[]>();
  if (jobIds.length === 0) return byJob;
  const { rows } = await db.query<{
    job_offer_id: string;
    name: string;
    normalized_name: string;
    is_required: boolean;
  }>(
    `SELECT js.job_offer_id, s.name, s.normalized_name, js.is_required
     FROM job_skills js JOIN skills s ON s.id = js.skill_id
     WHERE js.job_offer_id = ANY($1::uuid[])
     ORDER BY js.job_offer_id, js.is_required DESC, s.normalized_name`,
    [jobIds],
  );
  for (const row of rows) {
    const list = byJob.get(row.job_offer_id) ?? [];
    list.push({ name: row.name, normalizedName: row.normalized_name, isRequired: row.is_required });
    byJob.set(row.job_offer_id, list);
  }
  return byJob;
}

export class PgJobOfferRepository implements JobOfferRepository {
  constructor(private readonly pool: DbPool) {}

  async findById(id: string): Promise<JobOffer | null> {
    const { rows } = await this.pool.query<JobOfferRow>(
      `SELECT ${JOB_OFFER_COLUMNS} FROM job_offers jo WHERE jo.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const skills = await loadJobSkills(this.pool, [row.id]);
    return toJobOffer(row, skills.get(row.id) ?? []);
  }

  async findActive(): Promise<JobOffer[]> {
    const { rows } = await this.pool.query<JobOfferRow>(
      `SELECT ${JOB_OFFER_COLUMNS} FROM job_offers jo WHERE jo.is_active ORDER BY jo.id`,
    );
    const skills = await loadJobSkills(
      this.pool,
      rows.map((r) => r.id),
    );
    return rows.map((r) => toJobOffer(r, skills.get(r.id) ?? []));
  }

  async upsert(offer: NormalizedJobOffer, seenAt: Date): Promise<UpsertOutcome> {
    return withTransaction(this.pool, async (client) => {
      const existingId = await this.findExistingId(client, offer);
      const id = existingId ?? randomUUID();
      const values = [
        id,
        offer.externalId,
        offer.source,
        offer.sourceUrl,
        offer.title,
        offer.company,
        offer.location,
        offer.modality,
        offer.description,
        offer.requirements.join('\n'),
        offer.seniority,
        offer.experienceYearsMin,
        offer.educationRequirements ? JSON.stringify(offer.educationRequirements) : null,
        JSON.stringify(offer.languageRequirements),
        offer.publishedAt,
        seenAt,
      ];
      if (existingId) {
        await client.query(
          `UPDATE job_offers SET external_id = COALESCE($2, external_id), source = $3,
             source_url = $4, title = $5, company = $6, location = $7, modality = $8,
             description = $9, requirements = $10, seniority = $11, experience_years_min = $12,
             education_requirements = $13, language_requirements = $14,
             published_at = COALESCE($15, published_at), last_seen_at = $16, is_active = true,
             updated_at = now()
           WHERE id = $1`,
          values,
        );
        await client.query('DELETE FROM job_skills WHERE job_offer_id = $1', [id]);
      } else {
        await client.query(
          `INSERT INTO job_offers (id, external_id, source, source_url, title, company, location,
             modality, description, requirements, seniority, experience_years_min,
             education_requirements, language_requirements, published_at, first_seen_at,
             last_seen_at, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, true)`,
          values,
        );
      }
      await this.saveSkills(client, id, offer.skills);
      return existingId ? 'updated' : 'inserted';
    });
  }

  async markUnseenInactive(source: JobSource, seenBefore: Date): Promise<number> {
    const result = await this.pool.query(
      `UPDATE job_offers SET is_active = false, updated_at = now()
       WHERE source = $1 AND is_active AND last_seen_at < $2`,
      [source, seenBefore],
    );
    return result.rowCount ?? 0;
  }

  /** Dedup priority (docs/05-FUENTES-DE-OFERTAS.md): externalId, URL, source+title+company+location. */
  private async findExistingId(
    client: DbClient,
    offer: NormalizedJobOffer,
  ): Promise<string | null> {
    if (offer.externalId) {
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM job_offers WHERE source = $1 AND external_id = $2',
        [offer.source, offer.externalId],
      );
      if (rows[0]) return rows[0].id;
    }
    const byUrl = await client.query<{ id: string }>(
      'SELECT id FROM job_offers WHERE source_url = $1',
      [offer.sourceUrl],
    );
    if (byUrl.rows[0]) return byUrl.rows[0].id;
    const byFields = await client.query<{ id: string }>(
      `SELECT id FROM job_offers
       WHERE source = $1 AND lower(title) = lower($2) AND lower(company) = lower($3)
         AND lower(coalesce(location, '')) = lower(coalesce($4, ''))
       ORDER BY first_seen_at LIMIT 1`,
      [offer.source, offer.title, offer.company, offer.location],
    );
    return byFields.rows[0]?.id ?? null;
  }

  private async saveSkills(
    client: DbClient,
    jobId: string,
    skills: readonly JobSkill[],
  ): Promise<void> {
    if (skills.length === 0) return;
    const ids = await upsertSkills(client, skills);
    const required = new Map<string, boolean>();
    for (const skill of skills) {
      const skillId = ids.get(skill.normalizedName);
      if (skillId) required.set(skillId, (required.get(skillId) ?? false) || skill.isRequired);
    }
    await client.query(
      `INSERT INTO job_skills (job_offer_id, skill_id, is_required)
       SELECT $1, * FROM unnest($2::uuid[], $3::boolean[])`,
      [jobId, [...required.keys()], [...required.values()]],
    );
  }
}
