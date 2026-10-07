export const SENIORITY_ORDER = [
  'INTERN',
  'JUNIOR',
  'SEMI_SENIOR',
  'SENIOR',
  'LEAD',
  'MANAGER',
] as const;
export type KnownSeniority = (typeof SENIORITY_ORDER)[number];
export type Seniority = KnownSeniority | 'UNKNOWN';

export const MODALITIES = ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'] as const;
export type Modality = (typeof MODALITIES)[number];

export const LANGUAGE_LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVEL_ORDER)[number];

export const EDUCATION_LEVEL_ORDER = [
  'SECONDARY',
  'TERTIARY',
  'UNIVERSITY',
  'POSTGRADUATE',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVEL_ORDER)[number];

export const CV_STATUSES = ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'] as const;
export type CvStatus = (typeof CV_STATUSES)[number];

export const MATCH_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

export const JOB_SOURCES = ['getonboard'] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export function isKnownSeniority(value: Seniority): value is KnownSeniority {
  return value !== 'UNKNOWN';
}

export function seniorityRank(value: KnownSeniority): number {
  return SENIORITY_ORDER.indexOf(value);
}

export function languageLevelRank(value: LanguageLevel): number {
  return LANGUAGE_LEVEL_ORDER.indexOf(value);
}

export function educationLevelRank(value: EducationLevel): number {
  return EDUCATION_LEVEL_ORDER.indexOf(value);
}
