import { describe, expect, it } from 'vitest';
import { normalizeLanguageName, parseLanguageLevel } from './languages.js';
import { compareLocations, normalizeLocation } from './location.js';
import { extractSkillsFromText, normalizeSkill, skillKey, uniqueSkills } from './skills.js';

const names = (skills: { name: string }[]) => skills.map((s) => s.name);

describe('skill normalization', () => {
  it.each([
    ['JS', 'JavaScript'],
    ['ts', 'TypeScript'],
    ['Node', 'Node.js'],
    ['NodeJS', 'Node.js'],
    ['Postgres', 'PostgreSQL'],
    ['  react.js ', 'React'],
    ['C#', 'C#'],
    ['asp.net core', '.NET'],
  ])('resolves alias %s -> %s', (raw, expected) => {
    expect(normalizeSkill(raw)?.name).toBe(expected);
  });

  it('ignores case, whitespace and edge punctuation', () => {
    expect(skillKey('  Spring   Boot; ')).toBe('spring boot');
    expect(normalizeSkill('JAVASCRIPT.')?.name).toBe('JavaScript');
  });

  it('keeps unknown skills, normalized', () => {
    expect(normalizeSkill('  Elixir ')).toEqual({ name: 'Elixir', normalizedName: 'elixir' });
  });

  it('returns null for empty input', () => {
    expect(normalizeSkill('  , ')).toBeNull();
  });

  it('deduplicates by normalized name with stable ordering', () => {
    const skills = ['js', 'JavaScript', 'Python', 'node'].map((s) => normalizeSkill(s)!);
    expect(names(uniqueSkills(skills))).toEqual(['JavaScript', 'Node.js', 'Python']);
  });
});

describe('extractSkillsFromText', () => {
  it('finds skills with symbols and dots', () => {
    const text = 'Experiencia en C#, C++, .NET Core y Node.js. Conocimientos de PostgreSQL.';
    expect(names(extractSkillsFromText(text))).toEqual(
      expect.arrayContaining(['C#', 'C++', '.NET', 'Node.js', 'PostgreSQL']),
    );
  });

  it('does not read the "js" in "Node.js" as JavaScript', () => {
    expect(names(extractSkillsFromText('Experiencia con Node.js y Vue.js'))).toEqual([
      'Node.js',
      'Vue.js',
    ]);
  });

  it('does not match a skill inside a longer word', () => {
    expect(names(extractSkillsFromText('Desarrollador JavaScript'))).toEqual(['JavaScript']);
    expect(names(extractSkillsFromText('Manejo de MySQL'))).toEqual(['MySQL']);
    expect(extractSkillsFromText('Excelente comunicación, gestión del resto')).toEqual([]);
  });

  it('treats ambiguous short terms case-sensitively', () => {
    expect(names(extractSkillsFromText('Backend en Go y Docker'))).toEqual(['Docker', 'Go']);
    expect(names(extractSkillsFromText('lets go to the office'))).toEqual([]);
  });

  it('is deterministic', () => {
    const text = 'React, TypeScript, AWS, Docker, React';
    expect(extractSkillsFromText(text)).toEqual(extractSkillsFromText(text));
  });
});

describe('language normalization', () => {
  it('normalizes Spanish and English names', () => {
    expect(normalizeLanguageName('Inglés')).toBe('English');
    expect(normalizeLanguageName('castellano')).toBe('Spanish');
    expect(normalizeLanguageName('klingon')).toBeNull();
  });

  it.each([
    ['Inglés B2', 'B2'],
    ['nivel intermedio avanzado', 'B2'],
    ['intermedio', 'B1'],
    ['avanzado', 'C1'],
    ['bilingüe', 'C2'],
    ['Nativo', 'NATIVE'],
    ['lengua materna', 'NATIVE'],
    ['básico', 'A2'],
  ])('parses level from "%s"', (raw, level) => {
    expect(parseLanguageLevel(raw)).toBe(level);
  });

  it('returns null when no level is stated', () => {
    expect(parseLanguageLevel('Inglés')).toBeNull();
  });
});

describe('location normalization', () => {
  it('recognizes CABA variants', () => {
    expect(normalizeLocation('Capital Federal, Buenos Aires')).toEqual({
      city: 'caba',
      region: 'buenos aires',
    });
    expect(normalizeLocation('CABA')).toEqual({ city: 'caba', region: 'buenos aires' });
  });

  it('parses city and province', () => {
    expect(normalizeLocation('Vicente López, Buenos Aires, Argentina')).toEqual({
      city: 'vicente lopez',
      region: 'buenos aires',
    });
    expect(normalizeLocation('Córdoba')).toEqual({ city: null, region: 'cordoba' });
  });

  it('compares locations', () => {
    const caba = normalizeLocation('CABA');
    expect(compareLocations(caba, normalizeLocation('Capital Federal'))).toBe('SAME_CITY');
    expect(compareLocations(caba, normalizeLocation('Vicente López, Buenos Aires'))).toBe(
      'SAME_REGION',
    );
    expect(compareLocations(caba, normalizeLocation('Rosario, Santa Fe'))).toBe('INCOMPATIBLE');
    expect(compareLocations(caba, normalizeLocation(null))).toBe('UNKNOWN');
    expect(compareLocations(caba, normalizeLocation('Santiago, Chile'))).toBe('INCOMPATIBLE');
    expect(
      compareLocations(normalizeLocation('Santiago, Chile'), normalizeLocation('Santiago, Chile')),
    ).toBe('SAME_CITY');
    expect(compareLocations(normalizeLocation('Rosario'), normalizeLocation('Paraná'))).toBe(
      'UNKNOWN',
    );
  });
});
