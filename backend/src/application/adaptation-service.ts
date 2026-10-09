import type { EvaluationDocument } from '../cv-adaptation/document-schema.js';
import { documentToProfile } from '../cv-adaptation/document-to-profile.js';
import { buildAdaptedDraft } from '../cv-adaptation/draft-builder.js';
import type { AdaptedDraft } from '../cv-adaptation/types.js';
import type { CandidateProfile, JobOffer, MatchReason } from '../domain/entities.js';
import type { MatchLevel } from '../domain/enums.js';
import type { MatchingConfig } from '../matching/matching-config.js';
import { evaluateMatch } from '../matching/matching-engine.js';
import { AppError } from './errors.js';
import type {
  CandidateProfileRepository,
  Clock,
  CvRepository,
  JobOfferRepository,
} from './ports.js';

export interface AdaptationEvaluation {
  readonly original: { readonly level: MatchLevel };
  readonly adapted: { readonly level: MatchLevel; readonly reasons: readonly MatchReason[] };
}

export interface AdaptationContext {
  readonly profile: CandidateProfile;
  readonly job: JobOffer;
}

/** Use cases of CV adaptation (docs/15-ADAPTACION-DE-CV.md). Nothing is stored. */
export class AdaptationService {
  constructor(
    private readonly cvs: CvRepository,
    private readonly profiles: CandidateProfileRepository,
    private readonly jobs: JobOfferRepository,
    private readonly config: MatchingConfig,
    private readonly clock: Clock,
  ) {}

  async getDraft(cvId: string, jobId: string): Promise<AdaptedDraft & { job: JobOffer }> {
    const { profile, job } = await this.load(cvId, jobId);
    return { ...buildAdaptedDraft(profile, job), job };
  }

  /**
   * Evaluates the edited CV against the offer with the same, unchanged matching engine and
   * compares it with the original CV. Only levels and reasons are returned (the numeric score
   * stays internal); nothing is stored.
   */
  async evaluate(
    cvId: string,
    jobId: string,
    document: EvaluationDocument,
  ): Promise<AdaptationEvaluation> {
    const { profile, job } = await this.load(cvId, jobId);
    const adaptedProfile = documentToProfile(document, { id: profile.id, cvId }, this.clock.now());
    const original = evaluateMatch(profile, job, this.config);
    const adapted = evaluateMatch(adaptedProfile, job, this.config);
    return {
      original: { level: original.level },
      adapted: { level: adapted.level, reasons: adapted.reasons },
    };
  }

  /** Loads a processed CV's profile and the offer, or fails with the contract's errors. */
  async load(cvId: string, jobId: string): Promise<AdaptationContext> {
    const cv = await this.cvs.findById(cvId);
    if (!cv) throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
    const job = await this.jobs.findById(jobId);
    if (!job) throw new AppError('JOB_NOT_FOUND', 'No se encontró la oferta solicitada.');
    const profile =
      cv.processingStatus === 'PROCESSED' ? await this.profiles.findByCvId(cvId) : null;
    if (!profile) {
      throw new AppError(
        'CV_NOT_PROCESSED',
        'El CV todavía no terminó de procesarse o no se pudo procesar.',
      );
    }
    return { profile, job };
  }
}
