import { buildAdaptedDraft } from '../cv-adaptation/draft-builder.js';
import type { AdaptedDraft } from '../cv-adaptation/types.js';
import type { CandidateProfile, JobOffer } from '../domain/entities.js';
import { AppError } from './errors.js';
import type { CandidateProfileRepository, CvRepository, JobOfferRepository } from './ports.js';

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
  ) {}

  async getDraft(cvId: string, jobId: string): Promise<AdaptedDraft & { job: JobOffer }> {
    const { profile, job } = await this.load(cvId, jobId);
    return { ...buildAdaptedDraft(profile, job), job };
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
