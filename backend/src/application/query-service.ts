import type { JobOffer } from '../domain/entities.js';
import { findVisibleCv } from './cv-access.js';
import { AppError } from './errors.js';
import type {
  CvRepository,
  JobOfferRepository,
  MatchResultRepository,
  Recommendation,
} from './ports.js';

export class QueryService {
  constructor(
    private readonly cvs: CvRepository,
    private readonly jobs: JobOfferRepository,
    private readonly matches: MatchResultRepository,
  ) {}

  /**
   * MEDIUM/HIGH matches on active offers, best first. Empty until the CV is processed.
   * Visitors without an account see the first `anonymousLimit` (an account privilege); the
   * rest are only counted, so the hidden ones never reach the client. `saved`: the CV is in
   * the viewer's account.
   */
  async getRecommendations(
    cvId: string,
    viewerId: string | null,
    anonymousLimit: number,
  ): Promise<{ recommendations: Recommendation[]; hiddenCount: number; saved: boolean }> {
    const cv = await findVisibleCv(this.cvs, cvId, viewerId);
    const saved = cv.userId !== null && cv.userId === viewerId;
    if (cv.processingStatus !== 'PROCESSED') {
      return { recommendations: [], hiddenCount: 0, saved };
    }
    const all = await this.matches.findRecommendations(cvId);
    if (viewerId) return { recommendations: all, hiddenCount: 0, saved };
    return {
      recommendations: all.slice(0, anonymousLimit),
      hiddenCount: Math.max(0, all.length - anonymousLimit),
      saved,
    };
  }

  async getJob(jobId: string): Promise<JobOffer> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new AppError('JOB_NOT_FOUND', 'No se encontró la oferta solicitada.');
    return job;
  }
}
