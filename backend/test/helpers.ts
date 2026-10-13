import { randomUUID } from 'node:crypto';
import { hashToken } from '../src/application/auth-service.js';
import { getEnv } from '../src/config/env.js';
import { createPool, type DbPool } from '../src/infrastructure/db/pool.js';
import { createLogger } from '../src/infrastructure/logging/logger.js';
import { ScryptPasswordHasher } from '../src/infrastructure/security/scrypt-password-hasher.js';

export const testLogger = createLogger('silent');

export function createTestPool(): DbPool {
  const url = getEnv().TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL must be set');
  return createPool(url);
}

export async function truncateAll(pool: DbPool): Promise<void> {
  await pool.query(
    `TRUNCATE match_results, job_skills, job_offers, candidate_skills, skills,
              languages, education, experiences, projects, candidate_profiles, cvs,
              sessions, users CASCADE`,
  );
}

/**
 * A verified user (with that password) and an open session, written straight to the
 * database. Returns the `Authorization` header value for endpoints that need an account.
 */
export async function createSession(pool: DbPool, password = 'clave-segura-123'): Promise<string> {
  const userId = randomUUID();
  const token = randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, email_verified_at)
     VALUES ($1, $2, $3, now())`,
    [userId, `${userId}@example.com`, await new ScryptPasswordHasher().hash(password)],
  );
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 day')`,
    [randomUUID(), userId, hashToken(token)],
  );
  return `Bearer ${token}`;
}
