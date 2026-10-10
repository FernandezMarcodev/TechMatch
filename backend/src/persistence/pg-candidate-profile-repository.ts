import { randomUUID } from 'node:crypto';
import type { CandidateProfileRepository } from '../application/ports.js';
import type {
  CandidateProfile,
  Education,
  Experience,
  Language,
  Project,
} from '../domain/entities.js';
import type { EducationLevel, LanguageLevel, Seniority } from '../domain/enums.js';
import { toNumber, withTransaction, type DbPool } from '../infrastructure/db/pool.js';
import { upsertSkills } from './skill-store.js';

interface ProfileRow {
  id: string;
  cv_id: string;
  summary: string | null;
  seniority: Seniority | null;
  total_experience_years: string | null;
  location: string | null;
}

interface ExperienceRow {
  company: string | null;
  position: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  years: string | null;
}

interface EducationRow {
  institution: string | null;
  degree: string | null;
  field: string | null;
  level: EducationLevel | 'UNKNOWN' | null;
  start_date: string | null;
  end_date: string | null;
}

interface ProjectRow {
  name: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

/**
 * Note: Experience.skills has no table (docs/07-DATABASE.md), so per-experience skills
 * are folded into the profile's skills and read back as empty.
 */
export class PgCandidateProfileRepository implements CandidateProfileRepository {
  constructor(private readonly pool: DbPool) {}

  async save(profile: CandidateProfile): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO candidate_profiles (id, cv_id, summary, seniority, total_experience_years, location)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          profile.id,
          profile.cvId,
          profile.summary,
          profile.seniority,
          profile.totalExperienceYears,
          profile.location,
        ],
      );
      for (const e of profile.experiences) {
        await client.query(
          `INSERT INTO experiences (id, candidate_profile_id, company, position, description,
                                    start_date, end_date, years)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            profile.id,
            e.company,
            e.position,
            e.description,
            e.startDate,
            e.endDate,
            e.years,
          ],
        );
      }
      for (const e of profile.education) {
        await client.query(
          `INSERT INTO education (id, candidate_profile_id, institution, degree, field, level,
                                  start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            profile.id,
            e.institution,
            e.degree,
            e.field,
            e.level,
            e.startDate,
            e.endDate,
          ],
        );
      }
      for (const [position, p] of profile.projects.entries()) {
        await client.query(
          `INSERT INTO projects (id, candidate_profile_id, name, description, start_date, end_date,
                                 position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), profile.id, p.name, p.description, p.startDate, p.endDate, position],
        );
      }
      for (const l of profile.languages) {
        await client.query(
          `INSERT INTO languages (id, candidate_profile_id, name, level) VALUES ($1, $2, $3, $4)`,
          [randomUUID(), profile.id, l.name, l.level],
        );
      }
      const ids = await upsertSkills(client, profile.skills);
      const skillIds = [...new Set(profile.skills.map((s) => ids.get(s.normalizedName)))].filter(
        (id): id is string => Boolean(id),
      );
      if (skillIds.length > 0) {
        await client.query(
          `INSERT INTO candidate_skills (candidate_profile_id, skill_id)
           SELECT $1, unnest($2::uuid[])`,
          [profile.id, skillIds],
        );
      }
    });
  }

  async findByCvId(cvId: string): Promise<CandidateProfile | null> {
    const { rows } = await this.pool.query<ProfileRow>(
      'SELECT * FROM candidate_profiles WHERE cv_id = $1',
      [cvId],
    );
    const row = rows[0];
    if (!row) return null;

    const [experiences, education, projects, languages, skills] = await Promise.all([
      this.pool.query<ExperienceRow>(
        `SELECT company, position, description, start_date::text, end_date::text, years
         FROM experiences WHERE candidate_profile_id = $1 ORDER BY start_date DESC NULLS LAST, id`,
        [row.id],
      ),
      this.pool.query<EducationRow>(
        `SELECT institution, degree, field, level, start_date::text, end_date::text
         FROM education WHERE candidate_profile_id = $1 ORDER BY start_date DESC NULLS LAST, id`,
        [row.id],
      ),
      // In the CV's order.
      this.pool.query<ProjectRow>(
        `SELECT name, description, start_date::text, end_date::text
         FROM projects WHERE candidate_profile_id = $1 ORDER BY position, id`,
        [row.id],
      ),
      this.pool.query<{ name: string; level: LanguageLevel | null }>(
        'SELECT name, level FROM languages WHERE candidate_profile_id = $1 ORDER BY name',
        [row.id],
      ),
      this.pool.query<{ name: string; normalized_name: string }>(
        `SELECT s.name, s.normalized_name FROM candidate_skills cs
         JOIN skills s ON s.id = cs.skill_id
         WHERE cs.candidate_profile_id = $1 ORDER BY s.normalized_name`,
        [row.id],
      ),
    ]);

    return {
      id: row.id,
      cvId: row.cv_id,
      summary: row.summary,
      seniority: row.seniority ?? 'UNKNOWN',
      totalExperienceYears: toNumber(row.total_experience_years),
      location: row.location,
      experiences: experiences.rows.map((e): Experience => ({
        company: e.company,
        position: e.position,
        description: e.description,
        startDate: e.start_date,
        endDate: e.end_date,
        years: toNumber(e.years),
        skills: [],
      })),
      education: education.rows.map((e): Education => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        level: e.level === 'UNKNOWN' ? null : e.level,
        startDate: e.start_date,
        endDate: e.end_date,
      })),
      projects: projects.rows.map((p): Project => ({
        name: p.name,
        description: p.description,
        startDate: p.start_date,
        endDate: p.end_date,
      })),
      languages: languages.rows.map((l): Language => ({ name: l.name, level: l.level })),
      skills: skills.rows.map((s) => ({ name: s.name, normalizedName: s.normalized_name })),
    };
  }
}
