import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../domain/entities.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { AppError } from './errors.js';
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  SessionRepository,
  UserRepository,
} from './ports.js';

export interface AuthServiceDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly hasher: PasswordHasher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly sessionTtlDays: number;
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

/** Emails are compared without surrounding spaces and case-insensitively. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
    return user;
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

    const now = clock.now();
    await sessions.deleteExpired(user.id, now);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + sessionTtlDays * 86_400_000);
    await sessions.create({
      id: ids.next(),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt, user };
  }

  /** The user of a valid session token; UNAUTHENTICATED otherwise. */
  async authenticate(token: string | null): Promise<User> {
    if (!token) throw unauthenticated();
    const user = await this.deps.sessions.findUser(hashToken(token), this.deps.clock.now());
    if (!user) throw unauthenticated();
    return user;
  }

  async logout(token: string): Promise<void> {
    await this.deps.sessions.delete(hashToken(token));
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
