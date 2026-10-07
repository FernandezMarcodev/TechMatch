import type { Language } from '../entities.js';
import type { LanguageLevel } from '../enums.js';
import { LANGUAGE_LEVEL_ORDER, languageLevelRank } from '../enums.js';
import { foldText } from '../text.js';

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  ingles: 'English',
  english: 'English',
  espanol: 'Spanish',
  castellano: 'Spanish',
  spanish: 'Spanish',
  portugues: 'Portuguese',
  portuguese: 'Portuguese',
  frances: 'French',
  french: 'French',
  aleman: 'German',
  german: 'German',
  italiano: 'Italian',
  italian: 'Italian',
  chino: 'Chinese',
  mandarin: 'Chinese',
  chinese: 'Chinese',
  japones: 'Japanese',
  japanese: 'Japanese',
};

/** Folded language words that can appear in free text. */
export const LANGUAGE_TERMS: readonly string[] = Object.keys(LANGUAGE_ALIASES);

export function normalizeLanguageName(raw: string): string | null {
  return LANGUAGE_ALIASES[foldText(raw)] ?? null;
}

// Ordered longest-first so "intermedio avanzado" wins over "intermedio".
const LEVEL_WORDS: readonly (readonly [string, LanguageLevel])[] = [
  ['upper intermediate', 'B2'],
  ['intermedio avanzado', 'B2'],
  ['intermedio-avanzado', 'B2'],
  ['intermedio alto', 'B2'],
  ['conversacional', 'B1'],
  ['intermediate', 'B1'],
  ['intermedio', 'B1'],
  ['bilingue', 'C2'],
  ['bilingual', 'C2'],
  ['nativo', 'C2'],
  ['native', 'C2'],
  ['lengua materna', 'C2'],
  ['fluido', 'C1'],
  ['fluent', 'C1'],
  ['avanzado', 'C1'],
  ['advanced', 'C1'],
  ['basico', 'A2'],
  ['basic', 'A2'],
  ['elemental', 'A2'],
  ['principiante', 'A1'],
  ['beginner', 'A1'],
];

/** Parses an explicit level (CEFR code or a common descriptor). Returns null if absent. */
export function parseLanguageLevel(raw: string): LanguageLevel | null {
  const text = foldText(raw);
  const cefr = /\b([abc][12])\b/.exec(text);
  if (cefr?.[1]) {
    const code = cefr[1].toUpperCase();
    const level = LANGUAGE_LEVEL_ORDER.find((l) => l === code);
    if (level) return level;
  }
  for (const [word, level] of LEVEL_WORDS) {
    if (text.includes(word)) return level;
  }
  return null;
}

const LANGUAGE_REGEX = new RegExp(`\\b(${LANGUAGE_TERMS.join('|')})\\b`, 'g');

/**
 * Finds languages mentioned in lines ("Inglés: avanzado (C1)", "Portugués básico"), keeping
 * the highest stated level per language. Pieces naming several languages are skipped as
 * ambiguous. With `requireLevel`, mentions without an explicit level are ignored.
 */
export function findLanguageMentions(lines: readonly string[], requireLevel: boolean): Language[] {
  const best = new Map<string, Language>();
  for (const line of lines) {
    for (const piece of line.split(/[;|]|,(?![^(]*\))/)) {
      const names = [...foldText(piece).matchAll(LANGUAGE_REGEX)]
        .map((m) => normalizeLanguageName(m[1] ?? ''))
        .filter((n): n is string => n !== null);
      const name = names[0];
      if (names.length !== 1 || !name) continue;
      const level = parseLanguageLevel(piece);
      if (requireLevel && !level) continue;
      const previous = best.get(name);
      if (
        !previous ||
        (level && (!previous.level || languageLevelRank(level) > languageLevelRank(previous.level)))
      ) {
        best.set(name, { name, level });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}
