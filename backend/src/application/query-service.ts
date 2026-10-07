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

  /** MEDIUM/HIGH matches on active offers, best first. Empty until the CV is processed. */
  async getRecommendations(cvId: string): Promise<Recommendation[]> {
    const cv = await this.cvs.findById(cvId);
    if (!cv) throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
    if (cv.processingStatus !== 'PROCESSED') return [];
    return this.matches.findRecommendations(cvId);
  }

  async getJob(jobId: string): Promise<JobOffer> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new AppError('JOB_NOT_FOUND', 'No se encontró la oferta solicitada.');
    return job;
  }
}
