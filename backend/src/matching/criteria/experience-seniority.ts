import { isKnownSeniority, seniorityRank, type Seniority } from '../../domain/enums.js';
import type { MatchingConfig } from '../matching-config.js';
import {
  SENIORITY_LABELS,
  formatYears,
  scored,
  unknown,
  type CriterionOutcome,
} from './outcome.js';

export function evaluateExperience(
  candidateYears: number | null,
  requiredYears: number | null,
  config: MatchingConfig,
): CriterionOutcome {
  if (requiredYears === null || requiredYears <= 0) {
    // No required years: any experience level meets it, so it counts as a match (not neutral).
    const message =
      candidateYears !== null && candidateYears > 0
        ? `La oferta no exige años de experiencia; el CV indica ${formatYears(candidateYears)}`
        : 'La oferta no exige años de experiencia';
    return scored(100, message, config);
  }
  if (candidateYears === null) {
    return unknown(
      `La oferta requiere ${formatYears(requiredYears)}; el CV no permite determinar la experiencia`,
    );
  }
  const required = formatYears(requiredYears);
  const candidate = formatYears(candidateYears);
  if (candidateYears >= requiredYears) {
    return scored(100, `La oferta requiere ${required} y el CV indica ${candidate}`, config);
  }
  return scored(
    (candidateYears / requiredYears) * 100,
    `La oferta requiere ${required} y el CV indica ${candidate}`,
    config,
  );
}

export function evaluateSeniority(
  candidate: Seniority,
  job: Seniority,
  config: MatchingConfig,
): CriterionOutcome {
  if (!isKnownSeniority(job)) {
    return unknown('La oferta no especifica seniority');
  }
  if (!isKnownSeniority(candidate)) {
    return unknown(
      `La oferta busca ${SENIORITY_LABELS[job]}; el CV no permite determinar el seniority`,
    );
  }
  const distance = Math.abs(seniorityRank(candidate) - seniorityRank(job));
  const table = config.seniority.scoreByDistance;
  const score = table[Math.min(distance, table.length - 1)] ?? 0;
  const message =
    distance === 0
      ? `Seniority compatible (${SENIORITY_LABELS[job]})`
      : `La oferta busca ${SENIORITY_LABELS[job]} y el CV indica ${SENIORITY_LABELS[candidate]}`;
  return scored(score, message, config);
}
