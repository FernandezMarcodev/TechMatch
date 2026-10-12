import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { createRoutes } from '../src/api/routes.js';
import { MemoryEmailSender } from '../src/infrastructure/email/memory-email-sender.js';
import { createContainer, type Container } from '../src/main/container.js';
import { createTestPool, testLogger, truncateAll } from './helpers.js';

const pool = createTestPool();
let now = new Date('2026-05-01T12:00:00Z');
let container: Container;
const mailbox = new MemoryEmailSender();

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
      EMAIL_VERIFICATION_TTL_HOURS: 24,
      PASSWORD_RESET_TTL_MINUTES: 30,
    },
    frontendUrl: 'http://techmatch.test',
    emailSender: mailbox,
    clock: { now: () => now },
  });
  app = appWith();
});

beforeEach(async () => {
  now = new Date('2026-05-01T12:00:00Z');
  await truncateAll(pool);
  mailbox.sent.length = 0;
});

afterAll(async () => {
  await pool.end();
});

const PASSWORD = 'clave-segura-123';
const register = (email: string, password = PASSWORD) =>
  request(app).post('/api/auth/register').send({ email, password });
const login = (email: string, password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });
/** The token of the last link sent by email to `email`. */
function linkToken(email: string): string {
  const message = mailbox.sent.findLast((m) => m.to === email);
  const match = /token=([\w-]+)/.exec(message?.text ?? '');
  if (!match?.[1]) throw new Error(`no link sent to ${email}`);
  return match[1];
}
const verify = (token: string) => request(app).post('/api/auth/verify-email').send({ token });
async function registerVerified(email: string) {
  await register(email);
  await verify(linkToken(email));
}
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
    const verified = await verify(linkToken('ana@example.com'));
    expect(verified.status).toBe(200);
    expect(verified.body.data.user.emailVerified).toBe(true);

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
    await registerVerified('ana@example.com');
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
    await registerVerified('ana@example.com');
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
    await registerVerified('ana@example.com');
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
    await registerVerified('ana@example.com');
    const { token } = (await login('ana@example.com')).body.data;
    now = new Date('2026-05-31T11:59:00Z');
    expect((await me(token)).status).toBe(200);
    now = new Date('2026-05-31T12:00:00Z');
    expect((await me(token)).status).toBe(401);
  });

  it('keeps several sessions of the same user independent', async () => {
    await registerVerified('ana@example.com');
    const first = (await login('ana@example.com')).body.data.token;
    const second = (await login('ana@example.com')).body.data.token;
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first}`);
    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(200);
  });
});

describe('email verification', () => {
  it('sends a link to the web app when the account is created', async () => {
    await register('ana@example.com');
    expect(mailbox.sent).toHaveLength(1);
    const [email] = mailbox.sent;
    expect(email?.to).toBe('ana@example.com');
    expect(email?.subject).toBe('Confirmá tu email en TechMatch');
    expect(email?.text).toMatch(/http:\/\/techmatch\.test\/verificar-email\?token=[\w-]{43}/);
    expect(email?.text).not.toContain(PASSWORD);
  });

  it('does not let an unverified account log in, only after the right password', async () => {
    await register('ana@example.com');
    const unverified = await login('ana@example.com');
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    // A wrong password still gets the generic error: it does not reveal the account state.
    expect((await login('ana@example.com', 'otra-clave-123')).body.error.code).toBe(
      'INVALID_CREDENTIALS',
    );

    await verify(linkToken('ana@example.com'));
    expect((await login('ana@example.com')).status).toBe(200);
  });

  it('accepts each link only once', async () => {
    await register('ana@example.com');
    const token = linkToken('ana@example.com');
    expect((await verify(token)).status).toBe(200);
    const again = await verify(token);
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects links after EMAIL_VERIFICATION_TTL_HOURS and unknown tokens', async () => {
    await register('ana@example.com');
    now = new Date('2026-05-02T12:00:00Z');
    expect((await verify(linkToken('ana@example.com'))).body.error.code).toBe('INVALID_TOKEN');
    expect((await verify('token-inventado')).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-email').send({})).status).toBe(400);
  });

  it('resends a new link that replaces the previous one', async () => {
    await register('ana@example.com');
    const first = linkToken('ana@example.com');
    const res = await request(app)
      .post('/api/auth/verify-email/resend')
      .send({ email: 'ANA@example.com' });
    expect(res.status).toBe(202);
    const second = linkToken('ana@example.com');
    expect(second).not.toBe(first);
    expect((await verify(first)).status).toBe(400);
    expect((await verify(second)).status).toBe(200);
  });

  it('answers the same to a resend for unknown or already verified emails, sending nothing', async () => {
    await registerVerified('ana@example.com');
    mailbox.sent.length = 0;
    const resend = (email: string) =>
      request(app).post('/api/auth/verify-email/resend').send({ email });
    expect((await resend('ana@example.com')).status).toBe(202);
    expect((await resend('nadie@example.com')).status).toBe(202);
    expect(mailbox.sent).toEqual([]);
  });

  it('keeps the account when the email cannot be sent, so it can be resent', async () => {
    const failing = mailbox.send.bind(mailbox);
    mailbox.send = () => Promise.reject(new Error('SMTP caído'));
    try {
      expect((await register('ana@example.com')).status).toBe(201);
    } finally {
      mailbox.send = failing;
    }
    await request(app).post('/api/auth/verify-email/resend').send({ email: 'ana@example.com' });
    expect((await verify(linkToken('ana@example.com'))).status).toBe(200);
  });
});

describe('password reset', () => {
  const requestReset = (email: string) =>
    request(app).post('/api/auth/password-reset').send({ email });
  const confirm = (token: string, password: string) =>
    request(app).post('/api/auth/password-reset/confirm').send({ token, password });

  it('emails a link, sets the new password and closes every open session', async () => {
    await registerVerified('ana@example.com');
    const oldSession = (await login('ana@example.com')).body.data.token;
    mailbox.sent.length = 0;

    expect((await requestReset('Ana@Example.com')).status).toBe(202);
    const [email] = mailbox.sent;
    expect(email?.subject).toBe('Restablecé tu contraseña de TechMatch');
    expect(email?.text).toMatch(/http:\/\/techmatch\.test\/restablecer\?token=[\w-]{43}/);
    expect(email?.text).toContain('vence en 30 minutos');

    expect((await confirm(linkToken('ana@example.com'), 'nueva-clave-456')).status).toBe(204);
    expect((await me(oldSession)).status).toBe(401);
    expect((await login('ana@example.com')).status).toBe(401);
    expect((await login('ana@example.com', 'nueva-clave-456')).status).toBe(200);
  });

  it('answers the same for unknown emails, sending nothing', async () => {
    expect((await requestReset('nadie@example.com')).status).toBe(202);
    expect(mailbox.sent).toEqual([]);
  });

  it('accepts each link once and only within PASSWORD_RESET_TTL_MINUTES', async () => {
    await registerVerified('ana@example.com');
    await requestReset('ana@example.com');
    const token = linkToken('ana@example.com');
    expect((await confirm(token, 'nueva-clave-456')).status).toBe(204);
    expect((await confirm(token, 'otra-clave-789')).body.error.code).toBe('INVALID_TOKEN');

    await requestReset('ana@example.com');
    now = new Date('2026-05-01T12:30:00Z');
    expect((await confirm(linkToken('ana@example.com'), 'otra-clave-789')).status).toBe(400);
  });

  it('only the latest link works, and a verification link is not a reset link', async () => {
    await register('ana@example.com');
    const verificationToken = linkToken('ana@example.com');
    expect((await confirm(verificationToken, 'nueva-clave-456')).status).toBe(400);

    await requestReset('ana@example.com');
    const first = linkToken('ana@example.com');
    await requestReset('ana@example.com');
    expect((await confirm(first, 'nueva-clave-456')).status).toBe(400);
    expect((await confirm(linkToken('ana@example.com'), 'nueva-clave-456')).status).toBe(204);
  });

  it('applies the password rules and verifies the email of the account', async () => {
    await register('ana@example.com');
    await requestReset('ana@example.com');
    const token = linkToken('ana@example.com');
    const short = await confirm(token, 'corta');
    expect(short.status).toBe(400);
    expect(short.body.error.message).toBe('La contraseña debe tener al menos 8 caracteres.');

    // The account was never verified: opening the reset link proves the email is theirs.
    expect((await confirm(token, 'nueva-clave-456')).status).toBe(204);
    expect((await login('ana@example.com', 'nueva-clave-456')).status).toBe(200);
  });

  it('still answers 202 when the email cannot be sent', async () => {
    await registerVerified('ana@example.com');
    const send = mailbox.send.bind(mailbox);
    mailbox.send = () => Promise.reject(new Error('Brevo caído'));
    try {
      expect((await requestReset('ana@example.com')).status).toBe(202);
    } finally {
      mailbox.send = send;
    }
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
