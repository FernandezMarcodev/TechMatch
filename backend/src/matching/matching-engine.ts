import {
  CRITERIA,
  type CandidateProfile,
  type CriterionName,
  type JobOffer,
  type MatchCriterion,
  type MatchEvaluation,
  type MatchReason,
} from '../domain/entities.js';
import type { MatchLevel } from '../domain/enums.js';
import { evaluateEducation, evaluateLanguages } from './criteria/education-languages.js';
import { evaluateExperience, evaluateSeniority } from './criteria/experience-seniority.js';
import {
  evaluateLocation,
  evaluateModality,
  resolveLocationState,
} from './criteria/location-modality.js';
import type { CriterionOutcome } from './criteria/outcome.js';
import { evaluateSkills } from './criteria/skills.js';
import type { MatchingConfig } from './matching-config.js';

function evaluateAll(
  profile: CandidateProfile,
  job: JobOffer,
  config: MatchingConfig,
): Record<CriterionName, CriterionOutcome> {
  const locationState = resolveLocationState(profile.location, job.location, job.modality);
  return {
    skills: evaluateSkills(profile.skills, job.skills, config),
    experience: evaluateExperience(profile.totalExperienceYears, job.experienceYearsMin, config),
    seniority: evaluateSeniority(profile.seniority, job.seniority, config),
    education: evaluateEducation(profile.education, job.educationRequirements, config),
    languages: evaluateLanguages(profile.languages, job.languageRequirements, config),
    location: evaluateLocation(locationState, job.location, config),
    modality: evaluateModality(job.modality, locationState, config),
  };
}

export function classify(score: number, config: MatchingConfig): MatchLevel {
  if (score >= config.thresholds.high) return 'HIGH';
  if (score >= config.thresholds.medium) return 'MEDIUM';
  return 'LOW';
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Deterministic CV/job matching (docs/03-MATCHING-SPEC.md).
 *
 * UNKNOWN criteria are excluded and their weight is redistributed proportionally among
 * the evaluable ones. Reasons are produced by the same evaluations that produce the
 * score. Same input + same config always yields the same output.
 */
export function evaluateMatch(
  profile: CandidateProfile,
  job: JobOffer,
  config: MatchingConfig,
): MatchEvaluation {
  const outcomes = evaluateAll(profile, job, config);

  const evaluatedWeight = CRITERIA.reduce(
    (sum, c) => (outcomes[c].score === null ? sum : sum + config.weights[c]),
    0,
  );

  const criteria: MatchCriterion[] = CRITERIA.map((criterion) => {
    const outcome = outcomes[criterion];
    const weight = config.weights[criterion];
    const effectiveWeight =
      outcome.score === null || evaluatedWeight === 0 ? 0 : weight / evaluatedWeight;
    return {
      criterion,
      score: outcome.score === null ? null : round(outcome.score, 2),
      weight,
      effectiveWeight: round(effectiveWeight, 6),
      status: outcome.status,
      evidence: outcome.message,
    };
  });

  const rawScore = CRITERIA.reduce((sum, c) => {
    const s = outcomes[c].score;
    return s === null || evaluatedWeight === 0
      ? sum
      : sum + s * (config.weights[c] / evaluatedWeight);
  }, 0);
  const score = Math.round(rawScore);

  const reasons: MatchReason[] = CRITERIA.map((criterion) => {
    const outcome = outcomes[criterion];
    return {
      criterion,
      status: outcome.status === 'unknown' ? 'neutral' : outcome.status,
      message: outcome.message,
    };
  });

  // Without evidence on a required criterion (e.g. no comparable skills) the offer is not
  // recommended. This is "insufficient evidence", not a mismatch, and the reason says so.
  const missingRequired = config.requiredCriteria.filter((c) => outcomes[c].score === null);
  // A criterion below its configured minimum (e.g. too few matching technologies) also
  // prevents a recommendation; its own (negative) reason already explains why.
  const belowMinimum = CRITERIA.filter((c) => {
    const minimum = config.criterionMinimums[c];
    const s = outcomes[c].score;
    return minimum !== undefined && s !== null && s < minimum;
  });
  const level: MatchLevel =
    evaluatedWeight === 0 || missingRequired.length > 0 || belowMinimum.length > 0
      ? 'LOW'
      : classify(score, config);

  return { score, level, criteria, reasons };
}
