import type { Skill } from '../entities.js';
import { escapeRegExp, foldText } from '../text.js';
import { SKILL_CATALOG } from './skill-catalog.js';

const EDGE_PUNCTUATION = /^[\s,;:!?()[\]{}"'*\u2022\u00b7-]+|[\s,;:!?()[\]{}"'*\u2022\u00b7-]+$/g;

/** Comparison key for a skill: lowercase, no accents, single spaces, no edge punctuation. */
export function skillKey(raw: string): string {
  return foldText(raw)
    .replace(EDGE_PUNCTUATION, '')
    .replace(/\.+$/, '') // trailing period only: a leading one is meaningful (".net")
    .replace(/\s*([/.])\s*/g, '$1');
}

const aliasIndex: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const def of SKILL_CATALOG) {
    map.set(skillKey(def.name), def.name);
    for (const alias of def.aliases) map.set(skillKey(alias), def.name);
  }
  return map;
})();

/**
 * Normalizes a skill name: resolves aliases (JS -> JavaScript, Postgres -> PostgreSQL)
 * and falls back to the cleaned input for skills outside the catalog.
 */
export function normalizeSkill(raw: string): Skill | null {
  const key = skillKey(raw);
  if (!key) return null;
  const canonical = aliasIndex.get(key);
  if (canonical) return { name: canonical, normalizedName: skillKey(canonical) };
  return { name: raw.trim().replace(/\s+/g, ' '), normalizedName: key };
}

/** De-duplicates by normalizedName and sorts, so results are deterministic. */
export function uniqueSkills<T extends Skill>(skills: Iterable<T>): T[] {
  const byKey = new Map<string, T>();
  for (const skill of skills) {
    if (!byKey.has(skill.normalizedName)) byKey.set(skill.normalizedName, skill);
  }
  return [...byKey.values()].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

interface TermMatcher {
  readonly pattern: RegExp;
  readonly caseSensitive: boolean;
  readonly skill: Skill;
}

// Term boundaries: not preceded by a letter/digit/".", not followed by a letter/digit/+/#.
// This lets "c#", "c++", ".net" and "node.js" match while "java" does not match "javascript"
// and the "js" in "node.js" is not read as JavaScript.
const matchers: readonly TermMatcher[] = SKILL_CATALOG.flatMap((def) => {
  const skill = { name: def.name, normalizedName: skillKey(def.name) };
  const caseSensitive = def.caseSensitive ?? false;
  return def.aliases.map((alias) => {
    const term = caseSensitive ? alias : foldText(alias);
    const body = term.split(' ').map(escapeRegExp).join('\\s+');
    return {
      pattern: new RegExp(`(?<![\\p{L}\\p{N}.])${body}(?![\\p{L}\\p{N}+#])`, 'u'),
      caseSensitive,
      skill,
    };
  });
});

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Finds catalog skills mentioned in free text. Never infers skills that are not written. */
export function extractSkillsFromText(text: string): Skill[] {
  const plain = stripDiacritics(text);
  const folded = plain.toLowerCase();
  const found = matchers
    .filter((m) => m.pattern.test(m.caseSensitive ? plain : folded))
    .map((m) => m.skill);
  return uniqueSkills(found);
}
