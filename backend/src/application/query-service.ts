import type { JobOffer } from '../domain/entities.js';
import { findVisibleCv } from './cv-access.js';
import { AppError } from './errors.js';
import { skillKey } from '../domain/normalization/skills.js';
import type {
  CandidateProfileRepository,
  CvRepository,
  JobOfferRepository,
  MatchResultRepository,
  Recommendation,
  SkillDemand,
} from './ports.js';

export class QueryService {
  constructor(
    private readonly cvs: CvRepository,
    private readonly jobs: JobOfferRepository,
    private readonly matches: MatchResultRepository,
    private readonly profiles: CandidateProfileRepository,
    private readonly demand: SkillDemand,
    /** How many missing technologies to show (MISSING_SKILLS_LIMIT). */
    private readonly missingSkillsLimit: number,
  ) {}

  /**
   * "Qué te falta": the technologies the active offers require most that were not found in
   * the CV, with the % of offers that require each. Empty until the CV is processed. Only a
   * suggestion of what to learn or to add if the candidate already knows it.
   */
  async getMissingSkills(
    cvId: string,
    viewerId: string | null,
  ): Promise<{ name: string; percent: number }[]> {
    const cv = await findVisibleCv(this.cvs, cvId, viewerId);
    if (cv.processingStatus !== 'PROCESSED') return [];
    const profile = await this.profiles.findByCvId(cvId);
    const has = new Set(profile?.skills.map((s) => s.normalizedName) ?? []);
    const required = await this.demand.requiredSkills();
    return required.filter((s) => !has.has(skillKey(s.name))).slice(0, this.missingSkillsLimit);
  }

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
