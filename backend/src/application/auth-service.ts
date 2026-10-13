import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../domain/entities.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { AppError } from './errors.js';
import type {
  Clock,
  EmailSender,
  EmailTokenRepository,
  IdGenerator,
  PasswordHasher,
  SessionRepository,
  UserRepository,
} from './ports.js';

export interface AuthServiceDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly emailTokens: EmailTokenRepository;
  readonly email: EmailSender;
  readonly hasher: PasswordHasher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly sessionTtlDays: number;
  readonly verificationTtlHours: number;
  readonly passwordResetTtlMinutes: number;
  /** Base of the links in the emails (the web app, not the API). */
  readonly frontendUrl: string;
}

export interface LoginResult {
  /** Handed to the client once; only its hash is stored. */
  readonly token: string;
  readonly expiresAt: Date;
  readonly user: User;
}

const invalidCredentials = () =>
  new AppError('INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
const unauthenticated = () =>
  new AppError('UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar.');
const invalidToken = () =>
  new AppError(
    'INVALID_TOKEN',
    'El link no es válido o ya venció. Pedí uno nuevo e intentá otra vez.',
  );

/** Emails are compared without surrounding spaces and case-insensitively. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 random bytes: impossible to guess. The client gets the token; the database, its hash. */
function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** Accounts and sessions (docs/17-CUENTAS-DE-USUARIO.md). Input format is validated by the API. */
export class AuthService {
  /** Compared against when the email does not exist, so both cases take the same time. */
  private dummyHash: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {}

  async register(email: string, password: string): Promise<User> {
    const { users, hasher, clock, ids, logger } = this.deps;
    const now = clock.now();
    const user: User = {
      id: ids.next(),
      email: normalizeEmail(email),
      passwordHash: await hasher.hash(password),
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if ((await users.create(user)) === 'duplicate') {
      throw new AppError('EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta con ese email.');
    }
    logger.info({ userId: user.id }, 'User registered');
    // If the email fails the account still exists: the person can ask for it again.
    await this.sendVerification(user).catch((err: unknown) => {
      logger.error({ err, userId: user.id }, 'Verification email failed');
    });
    return user;
  }

  /** Confirms the email with the token of the verification link. */
  async verifyEmail(token: string): Promise<User> {
    const { emailTokens, users, clock, logger } = this.deps;
    const now = clock.now();
    const userId = await emailTokens.consume(hashToken(token), 'VERIFY_EMAIL', now);
    const user = userId ? await users.markEmailVerified(userId, now) : null;
    if (!user) throw invalidToken();
    logger.info({ userId: user.id }, 'Email verified');
    return user;
  }

  /**
   * Sends a new verification link if the account exists and is not verified yet. Silent
   * otherwise, so the response does not reveal which emails have an account.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.deps.users.findByEmail(normalizeEmail(email));
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user);
  }

  /**
   * "Olvidé mi contraseña": emails a reset link if the account exists. Silent otherwise, and
   * also when the email fails (logged), so the response never reveals which emails exist.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { users, emailTokens, email: sender, clock, ids, logger } = this.deps;
    const { passwordResetTtlMinutes, frontendUrl } = this.deps;
    const user = await users.findByEmail(normalizeEmail(email));
    if (!user) return;
    const now = clock.now();
    const { token, tokenHash } = newToken();
    await emailTokens.replace({
      id: ids.next(),
      userId: user.id,
      purpose: 'RESET_PASSWORD',
      tokenHash,
      expiresAt: new Date(now.getTime() + passwordResetTtlMinutes * 60_000),
      createdAt: now,
    });
    const link = `${frontendUrl}/restablecer?token=${encodeURIComponent(token)}`;
    try {
      await sender.send({
        to: user.email,
        subject: 'Restablecé tu contraseña de TechMatch',
        text: [
          'Hola:',
          '',
          'Recibimos un pedido para restablecer la contraseña de tu cuenta en TechMatch.',
          'Para elegir una nueva, abrí este link:',
          '',
          link,
          '',
          `El link vence en ${passwordResetTtlMinutes} minutos y sirve una sola vez.`,
          'Si no lo pediste, ignorá este email: tu contraseña no cambia.',
          '',
          'El equipo de TechMatch',
        ].join('\n'),
      });
      logger.info({ userId: user.id }, 'Password reset email sent');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Password reset email failed');
    }
  }

  /**
   * Sets a new password with the token of the reset link and closes every open session.
   * Opening the link proves the person owns the email, so the email counts as verified.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const { emailTokens, users, sessions, hasher, clock, logger } = this.deps;
    const now = clock.now();
    const userId = await emailTokens.consume(hashToken(token), 'RESET_PASSWORD', now);
    if (!userId) throw invalidToken();
    await users.updatePassword(userId, await hasher.hash(password), now);
    await users.markEmailVerified(userId, now);
    await sessions.deleteAllForUser(userId);
    logger.info({ userId }, 'Password reset');
  }

  private async sendVerification(user: User): Promise<void> {
    const { emailTokens, email, clock, ids, verificationTtlHours, frontendUrl } = this.deps;
    const now = clock.now();
    const { token, tokenHash } = newToken();
    await emailTokens.replace({
      id: ids.next(),
      userId: user.id,
      purpose: 'VERIFY_EMAIL',
      tokenHash,
      expiresAt: new Date(now.getTime() + verificationTtlHours * 3_600_000),
      createdAt: now,
    });
    const link = `${frontendUrl}/verificar-email?token=${encodeURIComponent(token)}`;
    await email.send({
      to: user.email,
      subject: 'Confirmá tu email en TechMatch',
      text: [
        'Hola:',
        '',
        'Para terminar de crear tu cuenta en TechMatch, confirmá tu email con este link:',
        '',
        link,
        '',
        `El link vence en ${verificationTtlHours} horas y sirve una sola vez.`,
        'Si no creaste una cuenta, ignorá este email.',
        '',
        'El equipo de TechMatch',
      ].join('\n'),
    });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const { users, sessions, hasher, clock, ids, sessionTtlDays } = this.deps;
    const user = await users.findByEmail(normalizeEmail(email));
    if (!user) {
      // Same work as a wrong password: the response time does not reveal unknown emails.
      await hasher.verify(password, await this.getDummyHash());
      throw invalidCredentials();
    }
    if (!(await hasher.verify(password, user.passwordHash))) throw invalidCredentials();
    // Checked after the password: only the owner learns that the account is not verified.
    if (!user.emailVerifiedAt) {
      throw new AppError(
        'EMAIL_NOT_VERIFIED',
        'Todavía no confirmaste tu email. Revisá tu bandeja de entrada (y el spam).',
      );
    }

    const now = clock.now();
    await sessions.deleteExpired(user.id, now);
    const { token, tokenHash } = newToken();
    const expiresAt = new Date(now.getTime() + sessionTtlDays * 86_400_000);
    await sessions.create({
      id: ids.next(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt, user };
  }

  /** The user of a valid session token; UNAUTHENTICATED otherwise. */
  async authenticate(token: string | null): Promise<User> {
    const user = await this.currentUser(token);
    if (!user) throw unauthenticated();
    return user;
  }

  /** The user of a valid session token, or null (visitor, expired or unknown token). */
  async currentUser(token: string | null): Promise<User | null> {
    if (!token) return null;
    return this.deps.sessions.findUser(hashToken(token), this.deps.clock.now());
  }

  async logout(token: string): Promise<void> {
    await this.deps.sessions.delete(hashToken(token));
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
