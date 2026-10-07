import type { CandidateProfile, MatchResult } from '../domain/entities.js';
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

  async computeForProfile(profile: CandidateProfile): Promise<MatchResult[]> {
    const activeJobs = await this.jobs.findActive();
    const calculatedAt = this.clock.now();
    const results = activeJobs.map((job): MatchResult => ({
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
