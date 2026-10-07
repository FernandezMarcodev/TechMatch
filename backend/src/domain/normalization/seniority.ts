import type { KnownSeniority, Seniority } from '../enums.js';
import { foldText } from '../text.js';

// Checked in order: "semi senior" must win over "senior", "tech lead" over "lead".
const SENIORITY_PATTERNS: readonly (readonly [KnownSeniority, RegExp])[] = [
  ['SEMI_SENIOR', /\b(semi[\s-]?senior|semi[\s-]?sr|ssr)\b/],
  ['LEAD', /\b(tech lead|team lead|technical lead|lider tecnico|lider de equipo|lead)\b/],
  ['MANAGER', /\b(gerente|engineering manager|head of|director)\b/],
  ['SENIOR', /\b(senior|sr)\b/],
  ['JUNIOR', /\b(junior|jr)\b/],
  ['INTERN', /\b(trainee|pasante|pasantia|intern|internship|practicante)\b/],
];

/** Detects an explicitly stated seniority. Returns UNKNOWN rather than guessing. */
export function detectSeniority(text: string): Seniority {
  const folded = foldText(text);
  for (const [seniority, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(folded)) return seniority;
  }
  return 'UNKNOWN';
}
