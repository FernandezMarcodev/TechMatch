import type { Recommendation } from '../application/ports.js';
import type { JobOffer, MatchReason } from '../domain/entities.js';
import type { CvStatus, MatchLevel, Modality } from '../domain/enums.js';

/** API statuses are lowercase (docs/04-API-CONTRACTS.md); domain states are uppercase. */
export type CvStatusDto = 'uploaded' | 'processing' | 'processed' | 'failed';

export function toCvStatusDto(status: CvStatus): CvStatusDto {
  return status.toLowerCase() as CvStatusDto;
}

type ModalityDto = Exclude<Modality, 'UNKNOWN'> | null;

function toModalityDto(modality: Modality): ModalityDto {
  return modality === 'UNKNOWN' ? null : modality;
}

export interface JobSummaryDto {
  id: string;
  title: string;
  company: string;
  location: string | null;
  modality: ModalityDto;
  source: string;
  sourceUrl: string;
}

export interface RecommendationDto {
  job: JobSummaryDto;
  /** The numeric score is internal (ranking/classification); users only see the level. */
  match: { level: MatchLevel; reasons: MatchReason[] };
}

export interface JobDetailDto {
  id: string;
  title: string;
  company: string;
  location: string | null;
  modality: ModalityDto;
  description: string;
  requirements: string[];
  skills: string[];
  source: { name: string; url: string };
  isActive: boolean;
}

export function toRecommendationDto({ job, match }: Recommendation): RecommendationDto {
  return {
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      modality: toModalityDto(job.modality),
      source: job.source,
      sourceUrl: job.sourceUrl,
    },
    match: {
      level: match.level,
      reasons: match.reasons.map((r) => ({
        criterion: r.criterion,
        status: r.status,
        message: r.message,
      })),
    },
  };
}

export function toJobDetailDto(job: JobOffer): JobDetailDto {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    modality: toModalityDto(job.modality),
    description: job.description,
    requirements: [...job.requirements],
    skills: job.skills.map((s) => s.name),
    source: { name: job.source, url: job.sourceUrl },
    isActive: job.isActive,
  };
}
