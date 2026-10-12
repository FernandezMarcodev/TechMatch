import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

const hasher = new ScryptPasswordHasher();

describe('ScryptPasswordHasher', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hasher.hash('una contraseña larga');
    expect(stored).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(stored).not.toContain('una contraseña larga');
    expect(await hasher.verify('una contraseña larga', stored)).toBe(true);
    expect(await hasher.verify('otra contraseña', stored)).toBe(false);
  });

  it('uses a different salt each time, so equal passwords give different hashes', async () => {
    expect(await hasher.hash('misma-clave')).not.toBe(await hasher.hash('misma-clave'));
  });

  it('rejects hashes in an unknown format instead of failing', async () => {
    expect(await hasher.verify('x', 'bcrypt$abc')).toBe(false);
    expect(await hasher.verify('x', '')).toBe(false);
  });
});
