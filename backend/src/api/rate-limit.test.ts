import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { createApp } from './app.js';
import { createRateLimit } from './rate-limit.js';

const logger = createLogger('silent');

/** App with one limited endpoint and a clock the test moves by hand. */
function limitedApp(options: { trustProxy?: boolean } = {}) {
  let time = 0;
  const routes = Router();
  routes.post(
    '/limited',
    createRateLimit({ max: 2, windowMs: 60_000, now: () => time }),
    (_req, res) => {
      res.json({ data: { ok: true } });
    },
  );
  const app = createApp({ logger, corsOrigin: '*', routes, trustProxy: options.trustProxy });
  return { app, advance: (ms: number) => (time += ms) };
}

describe('createRateLimit', () => {
  it('lets through up to the limit and then answers 429 RATE_LIMITED', async () => {
    const { app } = limitedApp();
    expect((await request(app).post('/api/limited')).status).toBe(200);
    expect((await request(app).post('/api/limited')).status).toBe(200);

    const res = await request(app).post('/api/limited');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.details).toEqual({ retryAfterSeconds: 60 });
    expect(res.headers['retry-after']).toBe('60');
  });

  it('allows requests again once the window ends', async () => {
    const { app, advance } = limitedApp();
    await request(app).post('/api/limited');
    await request(app).post('/api/limited');
    advance(30_000);
    expect((await request(app).post('/api/limited')).headers['retry-after']).toBe('30');

    advance(30_000);
    expect((await request(app).post('/api/limited')).status).toBe(200);
  });

  it('counts each client IP separately behind a trusted proxy', async () => {
    const { app } = limitedApp({ trustProxy: true });
    const from = (ip: string) => request(app).post('/api/limited').set('X-Forwarded-For', ip);
    await from('203.0.113.1');
    await from('203.0.113.1');
    expect((await from('203.0.113.1')).status).toBe(429);
    expect((await from('203.0.113.2')).status).toBe(200);
  });
});

describe('TRUST_PROXY', () => {
  const parse = (value?: string) =>
    loadEnv({ DATABASE_URL: 'postgres://x', TRUST_PROXY: value }).TRUST_PROXY;

  it('accepts true, false or a number of hops', () => {
    expect(parse()).toBe(false);
    expect(parse('true')).toBe(true);
    expect(parse('false')).toBe(false);
    expect(parse('2')).toBe(2);
    expect(() => parse('yes')).toThrow(/TRUST_PROXY/);
  });
});
