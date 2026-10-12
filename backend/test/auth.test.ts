import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { createContainer, type Container } from '../src/main/container.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';

const pool = createTestPool();
let now = new Date('2026-05-01T12:00:00Z');
let container: Container;

function appWith(authRateLimit?: { max: number; windowMs: number }) {
  return createApp({
    logger: testLogger,
    corsOrigin: '*',
    routes: createRoutes({
      cvService: container.cvService,
      queries: container.queries,
      adaptation: container.adaptation,
      auth: container.auth,
      maxUploadBytes: 1_000_000,
      authRateLimit,
    }),
  });
}

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  container = createContainer({
    pool,
    logger: testLogger,
    env: {
      CV_MAX_SIZE_BYTES: 1_000_000,
      CV_STORAGE_DIR: './storage/test-auth',
      CV_MIN_TEXT_CHARS: 50,
      MATCHING_CONFIG_PATH: undefined,
      SESSION_TTL_DAYS: 30,
    },
    clock: { now: () => now },
  });
  app = appWith();
});

beforeEach(async () => {
  now = new Date('2026-05-01T12:00:00Z');
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

const PASSWORD = 'clave-segura-123';
const register = (email: string, password = PASSWORD) =>
  request(app).post('/api/auth/register').send({ email, password });
const login = (email: string, password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });
const me = (token?: string) => {
  const req = request(app).get('/api/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('accounts: register → login → me → logout', () => {
  it('works end to end and the old token stops working after logout', async () => {
    const created = await register('  Ana@Example.com ');
    expect(created.status).toBe(201);
    expect(created.body.data.user).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
      emailVerified: false,
      createdAt: '2026-05-01T12:00:00.000Z',
    });

    const session = await login('ANA@example.com');
    expect(session.status).toBe(200);
    const { token, expiresAt, user } = session.body.data;
    expect(token).toEqual(expect.any(String));
    expect(expiresAt).toBe('2026-05-31T12:00:00.000Z');
    expect(user.email).toBe('ana@example.com');

    const current = await me(token);
    expect(current.status).toBe(200);
    expect(current.body.data.user.email).toBe('ana@example.com');

    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);
    expect((await me(token)).status).toBe(401);
  });

  it('stores neither passwords nor tokens in plain text', async () => {
    await register('ana@example.com');
    const { token } = (await login('ana@example.com')).body.data;
    const { rows: users } = await pool.query('SELECT password_hash FROM users');
    const { rows: sessions } = await pool.query('SELECT token_hash FROM sessions');
    expect(users[0].password_hash).toMatch(/^scrypt\$/);
    expect(users[0].password_hash).not.toContain(PASSWORD);
    expect(sessions[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessions[0].token_hash).not.toBe(token);
  });

  it('never exposes the password hash', async () => {
    const res = await register('ana@example.com');
    expect(JSON.stringify(res.body)).not.toContain('scrypt');
  });
});

describe('register validation', () => {
  it('rejects an email that already has an account, ignoring case', async () => {
    await register('ana@example.com');
    const res = await register('ANA@example.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects a malformed email and a short password with a clear message', async () => {
    const badEmail = await register('ana-sin-arroba');
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error).toMatchObject({
      code: 'INVALID_INPUT',
      message: 'El email no tiene un formato válido.',
    });

    const shortPassword = await register('ana@example.com', 'corta');
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.message).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );

    const missing = await request(app).post('/api/auth/register').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('login and sessions', () => {
  it('answers the same for a wrong password and for an unknown email', async () => {
    await register('ana@example.com');
    const wrongPassword = await login('ana@example.com', 'otra-clave-123');
    const unknownEmail = await login('nadie@example.com');
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('requires a valid token', async () => {
    expect((await me()).body.error.code).toBe('UNAUTHENTICATED');
    expect((await me('token-inventado')).status).toBe(401);
    const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Basic abc');
    expect(malformed.status).toBe(401);
  });

  it('expires sessions after SESSION_TTL_DAYS', async () => {
    await register('ana@example.com');
    const { token } = (await login('ana@example.com')).body.data;
    now = new Date('2026-05-31T11:59:00Z');
    expect((await me(token)).status).toBe(200);
    now = new Date('2026-05-31T12:00:00Z');
    expect((await me(token)).status).toBe(401);
  });

  it('keeps several sessions of the same user independent', async () => {
    await register('ana@example.com');
    const first = (await login('ana@example.com')).body.data.token;
    const second = (await login('ana@example.com')).body.data.token;
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first}`);
    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(200);
  });
});

describe('attempt limit', () => {
  it('answers 429 after too many register/login attempts from one IP', async () => {
    const limited = appWith({ max: 2, windowMs: 60_000 });
    const attempt = () =>
      request(limited)
        .post('/api/auth/login')
        .send({ email: 'ana@example.com', password: PASSWORD });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toBe(
      'Hiciste demasiados intentos. Probá de nuevo en unos minutos.',
    );
  });
});

describe('CORS', () => {
  it('lets the frontend send the Authorization header', async () => {
    const res = await request(app).options('/api/auth/me');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
