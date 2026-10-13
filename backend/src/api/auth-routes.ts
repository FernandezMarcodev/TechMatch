import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthService } from '../application/auth-service.js';
import { AppError } from '../application/errors.js';
import type { User } from '../domain/entities.js';
import { toUserDto } from './dto.js';
import { createRateLimit } from './rate-limit.js';

const email = z
  .string({ error: 'Ingresá tu email.' })
  .trim()
  .max(254, 'El email es demasiado largo.')
  .pipe(z.email('El email no tiene un formato válido.'));

const registerSchema = z.object({
  email,
  password: z
    .string({ error: 'Ingresá una contraseña.' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(128, 'La contraseña puede tener hasta 128 caracteres.'),
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Ingresá tu contraseña.' }).min(1, 'Ingresá tu contraseña.').max(128),
});

const tokenSchema = z.object({
  token: z
    .string({ error: 'Falta el token del link.' })
    .min(1, 'Falta el token del link.')
    .max(200),
});

const emailOnlySchema = z.object({ email });

const resetSchema = z.object({
  token: z
    .string({ error: 'Falta el token del link.' })
    .min(1, 'Falta el token del link.')
    .max(200),
  password: registerSchema.shape.password,
});

const deleteAccountSchema = z.object({
  password: z
    .string({ error: 'Ingresá tu contraseña para confirmar.' })
    .min(1, 'Ingresá tu contraseña para confirmar.')
    .max(128),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Datos inválidos.', {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return parsed.data;
}

/** The token of an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
  return match?.[1] ?? null;
}

/** Rejects the request with 401 unless it carries a valid session; exposes `res.locals.user`. */
export function requireUser(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    res.locals.user = await auth.authenticate(bearerToken(req));
    next();
  };
}

export interface AuthRouteDeps {
  auth: AuthService;
  /** Limit of register/login attempts per client IP; without it they are unlimited (tests). */
  rateLimit?: { max: number; windowMs: number };
}

/** Accounts API under /api/auth (docs/17-CUENTAS-DE-USUARIO.md). */
export function createAuthRoutes({ auth, rateLimit }: AuthRouteDeps): Router {
  const router = Router();
  const limitAttempts: RequestHandler = rateLimit
    ? createRateLimit({
        ...rateLimit,
        message: 'Hiciste demasiados intentos. Probá de nuevo en unos minutos.',
      })
    : (_req, _res, next) => next();
  const authenticated = requireUser(auth);

  router.post('/register', limitAttempts, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const user = await auth.register(input.email, input.password);
    res.status(201).json({ data: { user: toUserDto(user) } });
  });

  router.post('/login', limitAttempts, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const { token, expiresAt, user } = await auth.login(input.email, input.password);
    res.json({ data: { token, expiresAt: expiresAt.toISOString(), user: toUserDto(user) } });
  });

  router.post('/verify-email', limitAttempts, async (req, res) => {
    const { token } = parse(tokenSchema, req.body);
    const user = await auth.verifyEmail(token);
    res.json({ data: { user: toUserDto(user) } });
  });

  // Always 202: the response does not reveal whether the email has an account.
  router.post('/verify-email/resend', limitAttempts, async (req, res) => {
    const input = parse(emailOnlySchema, req.body);
    await auth.resendVerification(input.email);
    res.sendStatus(202);
  });

  // Always 202: the response does not reveal whether the email has an account.
  router.post('/password-reset', limitAttempts, async (req, res) => {
    const input = parse(emailOnlySchema, req.body);
    await auth.requestPasswordReset(input.email);
    res.sendStatus(202);
  });

  router.post('/password-reset/confirm', limitAttempts, async (req, res) => {
    const input = parse(resetSchema, req.body);
    await auth.resetPassword(input.token, input.password);
    res.sendStatus(204);
  });

  router.post('/logout', authenticated, async (req, res) => {
    // `authenticated` already checked that the token exists and is valid.
    const token = bearerToken(req);
    if (token) await auth.logout(token);
    res.sendStatus(204);
  });

  // Deleting the account is irreversible: the password confirms it is really the owner.
  router.delete('/account', authenticated, async (req, res) => {
    const { password } = parse(deleteAccountSchema, req.body);
    await auth.deleteAccount(res.locals.user as User, password);
    res.sendStatus(204);
  });

  router.get('/me', authenticated, (_req, res) => {
    res.json({ data: { user: toUserDto(res.locals.user as User) } });
  });

  return router;
}
