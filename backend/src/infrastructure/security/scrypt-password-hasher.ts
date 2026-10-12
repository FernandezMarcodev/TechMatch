import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../../application/ports.js';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PREFIX = 'scrypt';

/**
 * Password hashing with Node's built-in scrypt (default cost: N=16384, r=8, p=1), a key
 * derivation function designed to be slow and memory-hard so leaked hashes are expensive to
 * brute-force. Each password gets its own random salt. Stored as `scrypt$<salt>$<hash>`
 * (base64), so the algorithm can change later knowing how each hash was made.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await scryptAsync(password, salt, KEY_BYTES);
    return [PREFIX, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [prefix, salt, key] = storedHash.split('$');
    if (prefix !== PREFIX || !salt || !key) return false;
    const expected = Buffer.from(key, 'base64');
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
    // Constant-time comparison: the response time does not reveal how much of it matched.
    return timingSafeEqual(actual, expected);
  }
}
