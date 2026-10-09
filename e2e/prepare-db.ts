/**
 * Creates (if needed), migrates and empties the E2E database.
 *
 * Runs as part of the backend webServer command, not as Playwright's globalSetup:
 * Playwright starts web servers before globalSetup, and the backend queries the database
 * on startup, so the database must exist before the server starts.
 */
import pg from 'pg';
import { migrateUp } from '../backend/src/infrastructure/db/migrator.js';
import { E2E_DATABASE_URL } from './e2e-env.js';

const url = new URL(E2E_DATABASE_URL);
const dbName = url.pathname.slice(1);

const admin = new pg.Client({
  connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString(),
});
await admin.connect();
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
await admin.end();

await migrateUp(E2E_DATABASE_URL);

const db = new pg.Client({ connectionString: E2E_DATABASE_URL });
await db.connect();
await db.query(
  `TRUNCATE match_results, job_skills, job_offers, candidate_skills, skills,
            languages, education, experiences, candidate_profiles, cvs CASCADE`,
);
await db.end();
