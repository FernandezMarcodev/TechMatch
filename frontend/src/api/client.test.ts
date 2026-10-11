import { describe, expect, it } from 'vitest';
import { normalizeApiUrl } from './client';

describe('normalizeApiUrl', () => {
  it('ignores spaces and trailing slashes pasted into the hosting panel', () => {
    expect(normalizeApiUrl(' https://techmatch.onrender.com ')).toBe(
      'https://techmatch.onrender.com',
    );
    expect(normalizeApiUrl('https://techmatch.onrender.com/ ')).toBe(
      'https://techmatch.onrender.com',
    );
  });

  it('means same origin when unset', () => {
    expect(normalizeApiUrl(undefined)).toBe('');
    expect(normalizeApiUrl('  ')).toBe('');
  });
});
