import type {
  EmailTokenRepository,
  SessionRepository,
  UserRepository,
} from '../application/ports.js';
import type { EmailToken, EmailTokenPurpose, Session, User } from '../domain/entities.js';
import type { Queryable } from '../infrastructure/db/pool.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const USER_COLUMNS =
  'u.id, u.email, u.password_hash, u.email_verified_at, u.created_at, u.updated_at';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Queryable) {}

  async create(user: User): Promise<'created' | 'duplicate'> {
    // ON CONFLICT also covers two registrations of the same email at the same time.
    const result = await this.db.query(
      `INSERT INTO users (id, email, password_hash, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [
        user.id,
        user.email,
        user.passwordHash,
        user.emailVerifiedAt,
        user.createdAt,
        user.updatedAt,
      ],
    );
    return result.rowCount === 1 ? 'created' : 'duplicate';
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u WHERE u.email = $1`,
      [email],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async markEmailVerified(userId: string, now: Date): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      `UPDATE users u
       SET email_verified_at = COALESCE(u.email_verified_at, $2), updated_at = $2
       WHERE u.id = $1
       RETURNING ${USER_COLUMNS}`,
      [userId, now],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}

export class PgEmailTokenRepository implements EmailTokenRepository {
  constructor(private readonly db: Queryable) {}

  async replace(token: EmailToken): Promise<void> {
    // A new link makes the previous unused ones useless: only the latest email works.
    await this.db.query(
      'DELETE FROM email_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL',
      [token.userId, token.purpose],
    );
    await this.db.query(
      `INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [token.id, token.userId, token.purpose, token.tokenHash, token.expiresAt, token.createdAt],
    );
  }

  async consume(tokenHash: string, purpose: EmailTokenPurpose, now: Date): Promise<string | null> {
    // One UPDATE checks and marks at once: two clicks at the same time cannot both succeed.
    const { rows } = await this.db.query<{ user_id: string }>(
      `UPDATE email_tokens SET used_at = $3
       WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > $3
       RETURNING user_id`,
      [tokenHash, purpose, now],
    );
    return rows[0]?.user_id ?? null;
  }
}

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: Queryable) {}

  async create(session: Session): Promise<void> {
    await this.db.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, session.tokenHash, session.expiresAt, session.createdAt],
    );
  }

  async findUser(tokenHash: string, now: Date): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>(
      `SELECT ${USER_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2`,
      [tokenHash, now],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpired(userId: string, now: Date): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= $2', [
      userId,
      now,
    ]);
  }
}
