import type { ReasonStatus } from '../../domain/entities.js';
import type { EducationLevel, KnownSeniority } from '../../domain/enums.js';
import type { MatchingConfig } from '../matching-config.js';

/** Result of evaluating one criterion. The message is the explanation shown to the user. */
export interface CriterionOutcome {
  readonly score: number | null;
  readonly status: ReasonStatus | 'unknown';
  readonly message: string;
}

export function scored(score: number, message: string, config: MatchingConfig): CriterionOutcome {
  const clamped = Math.min(100, Math.max(0, score));
  const status: ReasonStatus =
    clamped >= config.reasons.positiveFrom
      ? 'positive'
      : clamped < config.reasons.negativeBelow
        ? 'negative'
        : 'neutral';
  return { score: clamped, status, message };
}

/** The job states no requirement for this criterion: it must not penalize the candidate. */
export function notRequired(message: string): CriterionOutcome {
  return { score: 100, status: 'neutral', message };
}

/** Information is missing: neither a match nor a mismatch. Excluded from the score. */
export function unknown(message: string): CriterionOutcome {
  return { score: null, status: 'unknown', message };
}

export function formatYears(years: number): string {
  const rounded = Math.round(years * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} ${rounded === 1 ? 'año' : 'años'}`;
}

export const SENIORITY_LABELS: Readonly<Record<KnownSeniority, string>> = {
  INTERN: 'Trainee',
  JUNIOR: 'Junior',
  SEMI_SENIOR: 'Semi Senior',
  SENIOR: 'Senior',
  LEAD: 'Líder técnico',
  MANAGER: 'Gerente',
};

export const EDUCATION_LABELS: Readonly<Record<EducationLevel, string>> = {
  SECONDARY: 'secundario',
  TERTIARY: 'terciario',
  UNIVERSITY: 'universitario',
  POSTGRADUATE: 'posgrado',
};

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  English: 'inglés',
  Spanish: 'español',
  Portuguese: 'portugués',
  French: 'francés',
  German: 'alemán',
  Italian: 'italiano',
  Chinese: 'chino',
  Japanese: 'japonés',
};

export function languageLabel(name: string): string {
  return LANGUAGE_LABELS[name] ?? name;
}

export function listNames(names: readonly string[]): string {
  return names.join(', ');
}
