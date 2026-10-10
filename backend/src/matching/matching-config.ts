import { z } from 'zod';
import { CRITERIA, type CriterionName } from '../domain/entities.js';

const score = z.number().min(0).max(100);

const weightsSchema = z
  .object({
    skills: z.number().min(0),
    experience: z.number().min(0),
    seniority: z.number().min(0),
    education: z.number().min(0),
    languages: z.number().min(0),
    location: z.number().min(0),
    modality: z.number().min(0),
  })
  .refine((w) => Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9, {
    message: 'Matching weights must add up to 1',
  });

export const matchingConfigSchema = z
  .object({
    weights: weightsSchema,
    thresholds: z.object({ medium: score, high: score }),
    /** Criteria that must be evaluable; otherwise the match is LOW (insufficient evidence). */
    requiredCriteria: z.array(z.enum(CRITERIA)),
    /**
     * Minimum score a criterion must reach for the offer to be recommended. Without it, the
     * criteria that real offers rarely restrict (remote, no stated requirement) would lift
     * offers with almost no matching technologies into MEDIUM.
     */
    criterionMinimums: z.partialRecord(z.enum(CRITERIA), score),
    skills: z.object({
      requiredSkillWeight: z.number().positive(),
      optionalSkillWeight: z.number().positive(),
    }),
    /** Score by absolute seniority distance; the last entry applies to larger distances. */
    seniority: z.object({ scoreByDistance: z.array(score).min(1) }),
    education: z.object({
      /** Score when the candidate is one level below the requirement (more = 0). */
      oneLevelBelowScore: score,
      /** Multiplier applied when the field of study does not match. */
      fieldMismatchFactor: z.number().min(0).max(1),
      /**
       * Value of the candidate's education when the offer states no requirement: a degree
       * related to computing counts most; any engineering/licenciatura implies a general base.
       */
      withoutRequirement: z.object({
        universityComputing: score,
        universityOther: score,
        tertiaryComputing: score,
        tertiaryOther: score,
        secondary: score,
      }),
    }),
    location: z.object({
      sameCity: score,
      sameRegion: score,
      remote: score,
      incompatible: score,
    }),
    modality: z.object({
      remote: score,
      commutable: score,
      incompatible: score,
    }),
    /** Reason status thresholds applied to a criterion score. */
    reasons: z.object({ positiveFrom: score, negativeBelow: score }),
  })
  .refine((c) => c.thresholds.medium <= c.thresholds.high, {
    message: 'thresholds.medium must be <= thresholds.high',
  });

export type MatchingConfig = z.infer<typeof matchingConfigSchema>;
export type MatchingWeights = Record<CriterionName, number>;

/**
 * Defaults from docs/03-MATCHING-SPEC.md. Single source of truth.
 * Priority: technologies > seniority > experience > everything else (education first).
 */
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  weights: {
    skills: 0.35,
    seniority: 0.25,
    experience: 0.2,
    education: 0.1,
    languages: 0.05,
    location: 0.025,
    modality: 0.025,
  },
  thresholds: { medium: 50, high: 75 },
  requiredCriteria: ['skills'],
  // Skills below 40%, a seniority two or more levels away (score 20, e.g. Senior offer and
  // Junior CV) or an onsite/hybrid offer in another region (modality = 0) exclude the offer.
  criterionMinimums: { skills: 40, seniority: 50, modality: 50 },
  skills: { requiredSkillWeight: 2, optionalSkillWeight: 1 },
  seniority: { scoreByDistance: [100, 60, 20] },
  education: {
    oneLevelBelowScore: 50,
    fieldMismatchFactor: 0.5,
    withoutRequirement: {
      universityComputing: 100,
      universityOther: 75,
      tertiaryComputing: 85,
      tertiaryOther: 50,
      secondary: 40,
    },
  },
  location: { sameCity: 100, sameRegion: 70, remote: 100, incompatible: 0 },
  modality: { remote: 100, commutable: 100, incompatible: 0 },
  reasons: { positiveFrom: 75, negativeBelow: 50 },
};

export function parseMatchingConfig(input: unknown): MatchingConfig {
  return matchingConfigSchema.parse(input);
}
