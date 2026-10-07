import { randomUUID } from 'node:crypto';
import type { Skill } from '../domain/entities.js';
import type { Queryable } from '../infrastructure/db/pool.js';

/** Ensures the skills exist and returns their ids keyed by normalized name. */
export async function upsertSkills(
  db: Queryable,
  skills: readonly Skill[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  if (skills.length === 0) return ids;

  await db.query(
    `INSERT INTO skills (id, name, normalized_name)
     SELECT * FROM unnest($1::uuid[], $2::varchar[], $3::varchar[])
     ON CONFLICT DO NOTHING`,
    [
      skills.map(() => randomUUID()),
      skills.map((s) => s.name),
      skills.map((s) => s.normalizedName),
    ],
  );
  const { rows } = await db.query<{ id: string; normalized_name: string }>(
    `SELECT id, normalized_name FROM skills WHERE normalized_name = ANY($1::varchar[])`,
    [skills.map((s) => s.normalizedName)],
  );
  for (const row of rows) ids.set(row.normalized_name, row.id);
  return ids;
}
