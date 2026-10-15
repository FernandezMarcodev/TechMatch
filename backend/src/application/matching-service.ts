import type { CandidateProfile, JobOffer, MatchResult } from '../domain/entities.js';
import type { MatchingConfig } from '../matching/matching-config.js';
import { evaluateMatch } from '../matching/matching-engine.js';
import type { Clock, IdGenerator, JobOfferRepository, MatchResultRepository } from './ports.js';

/** Integrates the pure matching engine with persistence. */
export class MatchingService {
  constructor(
    private readonly jobs: JobOfferRepository,
    private readonly matches: MatchResultRepository,
    private readonly config: MatchingConfig,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** Active offers to match against; load them once when computing many CVs. */
  findActiveJobs(): Promise<JobOffer[]> {
    return this.jobs.findActive();
  }

  /** Replaces the CV's results with a fresh evaluation against the active offers. */
  async computeForProfile(
    profile: CandidateProfile,
    activeJobs?: readonly JobOffer[],
  ): Promise<MatchResult[]> {
    const jobs = activeJobs ?? (await this.jobs.findActive());
    const calculatedAt = this.clock.now();
    const results = jobs.map((job): MatchResult => ({
      ...evaluateMatch(profile, job, this.config),
      id: this.ids.next(),
      cvId: profile.cvId,
      jobOfferId: job.id,
      calculatedAt,
    }));
    await this.matches.replaceForCv(profile.cvId, results);
    return results;
  }
}
