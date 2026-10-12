import type {
  CandidateProfile,
  Cv,
  EducationRequirement,
  JobOffer,
  JobSkill,
  LanguageRequirement,
  MatchResult,
  Session,
  User,
} from '../domain/entities.js';
import type { CvStatus, JobSource, Modality, Seniority } from '../domain/enums.js';

export interface CvRepository {
  create(cv: Cv): Promise<void>;
  findById(id: string): Promise<Cv | null>;
  updateStatus(id: string, status: CvStatus, extractedText?: string | null): Promise<void>;
  /** Marks CVs left UPLOADED/PROCESSING by an interrupted process as FAILED. Returns how many. */
  failInterrupted(): Promise<number>;
  /** Deletes CVs created before `cutoff` (profiles and results go with them). Returns how many. */
  deleteCreatedBefore(cutoff: Date): Promise<number>;
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
  /** Removes the file; a file that no longer exists is not an error. */
  delete(storagePath: string): Promise<void>;
}

export interface UserRepository {
  /** Returns 'duplicate' (and stores nothing) when the email already has an account. */
  create(user: User): Promise<'created' | 'duplicate'>;
  findByEmail(email: string): Promise<User | null>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  /** The user of a session that exists and has not expired at `now`. */
  findUser(tokenHash: string, now: Date): Promise<User | null>;
  delete(tokenHash: string): Promise<void>;
  /** Removes the user's sessions that expired before `now`. */
  deleteExpired(userId: string, now: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
