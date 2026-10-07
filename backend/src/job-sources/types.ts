import type { JobSource } from '../domain/enums.js';

/**
 * An offer as published by a source, before normalization. Sources differ, so every field
 * except the identifying ones is optional.
 */
export interface RawJobOffer {
  readonly source: JobSource;
  readonly sourceUrl: string;
  readonly externalId?: string | null;
  readonly title: string;
  readonly company?: string | null;
  readonly location?: string | null;
  /** Free-text modality as published ("Remoto", "Híbrido", "Presencial"...). */
  readonly modality?: string | null;
  readonly description?: string | null;
  /** Requirement lines, when the source lists them separately. */
  readonly requirements?: readonly string[];
  /** Nice-to-have lines; skills found only here are optional for matching. */
  readonly desirable?: readonly string[];
  /** Skills/tags explicitly published by the source. */
  readonly skills?: readonly string[];
  readonly seniority?: string | null;
  readonly publishedAt?: Date | null;
  readonly fetchedAt: Date;
}

/**
 * A job source integrated through the interface it offers for automated access (a public
 * API or feed). Adding a source means adding a connector; matching is not affected.
 */
export interface JobSourceConnector {
  readonly source: JobSource;
  fetchOffers(): Promise<RawJobOffer[]>;
}

/** The source refused or limited access (HTTP 401/403/429). Never bypassed. */
export class SourceUnavailableError extends Error {
  constructor(
    readonly source: JobSource,
    readonly status: number,
  ) {
    super(`${source} refused access (HTTP ${status})`);
    this.name = 'SourceUnavailableError';
  }
}
