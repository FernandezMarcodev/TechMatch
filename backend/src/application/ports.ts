import type {
  CandidateProfile,
  Cv,
  EmailToken,
  EmailTokenPurpose,
  EducationRequirement,
  JobOffer,
  JobSkill,
  LanguageRequirement,
  MatchResult,
  SavedCv,
  Session,
  User,
} from '../domain/entities.js';
import type { CvStatus, JobSource, Modality, Seniority } from '../domain/enums.js';

export interface CvRepository {
  create(cv: Cv): Promise<void>;
  findById(id: string): Promise<Cv | null>;
  updateStatus(id: string, status: CvStatus): Promise<void>;
  /** Marks CVs left UPLOADED/PROCESSING by an interrupted process as FAILED. Returns how many. */
  failInterrupted(): Promise<number>;
  /**
   * Deletes unsaved CVs created before `cutoff` (profiles and results go with them); CVs
   * saved in an account are kept. Returns how many.
   */
  deleteCreatedBefore(cutoff: Date): Promise<number>;
  /** Ids of the CVs whose processing finished, to recalculate their recommendations. */
  findProcessedIds(): Promise<string[]>;
  /** Links the CV to the user's account. */
  saveForUser(cvId: string, userId: string, now: Date): Promise<void>;
  /** The user's saved CVs, most recently saved first. */
  findSavedByUser(userId: string): Promise<SavedCv[]>;
  /** Deletes the CV with its profile and results. */
  delete(cvId: string): Promise<void>;
}

/** How often each technology is required by the active offers ("Qué te falta"). */
export interface SkillDemand {
  /** Catalog technologies required by the active offers, most required first. */
  requiredSkills(): Promise<readonly { name: string; percent: number }[]>;
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
  /** Marks the email as verified (keeps the first date if it already was). */
  markEmailVerified(userId: string, now: Date): Promise<User | null>;
  updatePassword(userId: string, passwordHash: string, now: Date): Promise<void>;
  /** Deletes the account: sessions, email links and saved CVs go with it (cascade). */
  delete(userId: string): Promise<void>;
}

export interface EmailTokenRepository {
  /** Stores a new token and invalidates the user's unused ones with the same purpose. */
  replace(token: EmailToken): Promise<void>;
  /**
   * Marks the token as used if it exists, has that purpose, was not used and has not expired,
   * and returns its user id; null otherwise. Atomic, so a link works only once.
   */
  consume(tokenHash: string, purpose: EmailTokenPurpose, now: Date): Promise<string | null>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  /** The user of a session that exists and has not expired at `now`. */
  findUser(tokenHash: string, now: Date): Promise<User | null>;
  delete(tokenHash: string): Promise<void>;
  /** Removes the user's sessions that expired before `now`. */
  deleteExpired(userId: string, now: Date): Promise<void>;
  /** Closes every session of the user (after a password change). */
  deleteAllForUser(userId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Plain text body (Spanish). Never contains passwords. */
  readonly text: string;
}

/** Sends transactional emails (docs/17-CUENTAS-DE-USUARIO.md § Email). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
