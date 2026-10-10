import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createApp } from './app.js';

const logger = createLogger('silent');
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'techmatch-frontend-'));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>TechMatch</title>');
  await writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("app")');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createApp serving the built frontend (single-service deployment)', () => {
  const app = () => createApp({ logger, corsOrigin: '*', frontendDir: dir });

  it('serves static assets', async () => {
    const res = await request(app()).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('console.log');
  });

  it('answers client-side routes with index.html', async () => {
    for (const route of ['/', '/cv/abc/recomendaciones', '/ofertas/xyz']) {
      const res = await request(app()).get(route);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>TechMatch</title>');
    }
  });

  it('keeps the API contract: health works and unknown API routes are JSON 404', async () => {
    expect((await request(app()).get('/api/health')).body).toEqual({ data: { status: 'ok' } });
    const missing = await request(app()).get('/api/no-existe');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBeDefined();
  });

  it('does not serve the frontend when not configured (development)', async () => {
    const res = await request(createApp({ logger, corsOrigin: '*' })).get('/');
    expect(res.status).toBe(404);
  });
});
