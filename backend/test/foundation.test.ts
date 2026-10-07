import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createTestPool, testLogger } from './helpers.js';

const pool = createTestPool();

afterAll(async () => {
  await pool.end();
});

describe('foundation', () => {
  it('serves the health endpoint', async () => {
    const app = createApp({ logger: testLogger, corsOrigin: '*' });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('has the schema migrated', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'cvs',
        'candidate_profiles',
        'experiences',
        'education',
        'languages',
        'skills',
        'candidate_skills',
        'job_offers',
        'job_skills',
        'match_results',
      ]),
    );
  });
});
