import type {
  CandidateProfile,
  Cv,
  EducationRequirement,
  JobOffer,
  JobSkill,
  LanguageRequirement,
  MatchResult,
} from '../domain/entities.js';
import type { CvStatus, JobSource, Modality, Seniority } from '../domain/enums.js';

export interface CvRepository {
  create(cv: Cv): Promise<void>;
  findById(id: string): Promise<Cv | null>;
  updateStatus(id: string, status: CvStatus, extractedText?: string | null): Promise<void>;
}

export interface CandidateProfileRepository {
  save(profile: CandidateProfile): Promise<void>;
  findByCvId(cvId: string): Promise<CandidateProfile | null>;
}

/** An offer from a job source after normalization, ready to be persisted. */
export interface NormalizedJobOffer {
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
}

export type UpsertOutcome = 'inserted' | 'updated';

export interface JobOfferRepository {
  findById(id: string): Promise<JobOffer | null>;
  findActive(): Promise<JobOffer[]>;
  /** Inserts or updates using the dedup priority externalId → URL → source+title+company+location. */
  upsert(offer: NormalizedJobOffer, seenAt: Date): Promise<UpsertOutcome>;
  /** Marks offers of a source not seen since `seenBefore` as inactive. Never deletes. */
  markUnseenInactive(source: JobSource, seenBefore: Date): Promise<number>;
}

export interface Recommendation {
  readonly job: JobOffer;
  readonly match: MatchResult;
}

export interface MatchResultRepository {
  /** Replaces all stored results for the CV. */
  replaceForCv(cvId: string, results: readonly MatchResult[]): Promise<void>;
  /** MEDIUM/HIGH results for active offers, ordered by score DESC. */
  findRecommendations(cvId: string): Promise<Recommendation[]>;
}

/** Private storage for uploaded files. Paths are never exposed through the API. */
export interface FileStorage {
  save(id: string, content: Buffer): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
