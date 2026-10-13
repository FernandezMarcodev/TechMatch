import type {
  CvStatus,
  EducationLevel,
  JobSource,
  LanguageLevel,
  MatchLevel,
  Modality,
  Seniority,
} from './enums.js';

/** ISO-8601 calendar date (YYYY-MM-DD). */
export type IsoDate = string;

export interface Cv {
  readonly id: string;
  readonly originalFilename: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly processingStatus: CvStatus;
  /** Owner, only when the user chose to save the CV in their account; null otherwise. */
  readonly userId: string | null;
  readonly savedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A saved CV in the account's history. */
export interface SavedCv {
  readonly id: string;
  readonly originalFilename: string;
  readonly createdAt: Date;
  readonly savedAt: Date;
  /** MEDIUM/HIGH results on offers that are still active. */
  readonly recommendationCount: number;
}

export interface Skill {
  readonly name: string;
  readonly normalizedName: string;
}

export interface Experience {
  readonly company: string | null;
  readonly position: string | null;
  readonly description: string | null;
  readonly startDate: IsoDate | null;
  readonly endDate: IsoDate | null;
  readonly years: number | null;
  readonly skills: readonly Skill[];
}

/** A personal or academic project listed in the CV ("Proyectos"). */
export interface Project {
  readonly name: string | null;
  readonly description: string | null;
  readonly startDate: IsoDate | null;
  readonly endDate: IsoDate | null;
}

export interface Education {
  readonly institution: string | null;
  readonly degree: string | null;
  readonly field: string | null;
  readonly level: EducationLevel | null;
  readonly startDate: IsoDate | null;
  readonly endDate: IsoDate | null;
}

export interface Language {
  /** Canonical language name, e.g. "English". */
  readonly name: string;
  readonly level: LanguageLevel | null;
}

/**
 * Structured data extracted from a CV. Anything that cannot be determined from the
 * CV is null / 'UNKNOWN' — never guessed.
 */
export interface CandidateProfile {
  readonly id: string;
  readonly cvId: string;
  readonly summary: string | null;
  readonly seniority: Seniority;
  readonly totalExperienceYears: number | null;
  readonly location: string | null;
  readonly experiences: readonly Experience[];
  readonly education: readonly Education[];
  readonly projects: readonly Project[];
  readonly skills: readonly Skill[];
  readonly languages: readonly Language[];
}

export interface JobSkill extends Skill {
  readonly isRequired: boolean;
}

export interface EducationRequirement {
  readonly level: EducationLevel | null;
  /** Accepted fields of study (free text, e.g. "Sistemas"). Empty = any field. */
  readonly fields: readonly string[];
}

export interface LanguageRequirement {
  readonly name: string;
  readonly level: LanguageLevel | null;
}

export interface JobOffer {
  readonly id: string;
  readonly externalId: string | null;
  readonly source: JobSource;
  readonly sourceUrl: string;
  readonly title: string;
  readonly company: string;
  readonly location: string | null;
  readonly modality: Modality;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly skills: readonly JobSkill[];
  readonly seniority: Seniority;
  readonly experienceYearsMin: number | null;
  readonly educationRequirements: EducationRequirement | null;
  readonly languageRequirements: readonly LanguageRequirement[];
  readonly publishedAt: Date | null;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly isActive: boolean;
}

/** Matching criteria in priority order (also the order of reasons shown to the user). */
export const CRITERIA = [
  'skills',
  'seniority',
  'experience',
  'education',
  'languages',
  'location',
  'modality',
] as const;
export type CriterionName = (typeof CRITERIA)[number];

export type ReasonStatus = 'positive' | 'negative' | 'neutral';

export interface MatchReason {
  readonly criterion: CriterionName;
  readonly status: ReasonStatus;
  readonly message: string;
}

export interface MatchCriterion {
  readonly criterion: CriterionName;
  /** 0–100, or null when the criterion could not be evaluated (UNKNOWN). */
  readonly score: number | null;
  /** Configured weight (0–1). */
  readonly weight: number;
  /** Weight actually applied after redistributing UNKNOWN criteria (0–1). */
  readonly effectiveWeight: number;
  readonly status: ReasonStatus | 'unknown';
  readonly evidence: string;
}

/** Pure output of the matching engine: no ids, no timestamps (keeps it deterministic). */
export interface MatchEvaluation {
  readonly score: number;
  readonly level: MatchLevel;
  readonly criteria: readonly MatchCriterion[];
  readonly reasons: readonly MatchReason[];
}

export interface MatchResult extends MatchEvaluation {
  readonly id: string;
  readonly cvId: string;
  readonly jobOfferId: string;
  readonly calculatedAt: Date;
}

/** Optional account (docs/17-CUENTAS-DE-USUARIO.md). The email is stored normalized. */
export interface User {
  readonly id: string;
  readonly email: string;
  /** `scrypt$<salt>$<hash>`; never leaves the backend. */
  readonly passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Session {
  readonly id: string;
  readonly userId: string;
  /** SHA-256 (hex) of the token handed to the client; the token itself is never stored. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export type EmailTokenPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

/** Single-use link sent by email; only its hash is stored. */
export interface EmailToken {
  readonly id: string;
  readonly userId: string;
  readonly purpose: EmailTokenPurpose;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}
