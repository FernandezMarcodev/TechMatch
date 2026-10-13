import type { JobOffer } from '../domain/entities.js';
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
   * `visibleLimit`: how many a visitor without an account sees (null = all, for accounts);
   * the rest are only counted, so the order and the hidden ones never reach the client.
   */
  async getRecommendations(
    cvId: string,
    visibleLimit: number | null = null,
  ): Promise<{ recommendations: Recommendation[]; hiddenCount: number }> {
    const cv = await this.cvs.findById(cvId);
    if (!cv) throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
    if (cv.processingStatus !== 'PROCESSED') return { recommendations: [], hiddenCount: 0 };
    const all = await this.matches.findRecommendations(cvId);
    if (visibleLimit === null) return { recommendations: all, hiddenCount: 0 };
    return {
      recommendations: all.slice(0, visibleLimit),
      hiddenCount: Math.max(0, all.length - visibleLimit),
    };
  }

  async getJob(jobId: string): Promise<JobOffer> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new AppError('JOB_NOT_FOUND', 'No se encontró la oferta solicitada.');
    return job;
  }
}
