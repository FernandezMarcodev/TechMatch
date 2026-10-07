import type { Clock, JobOfferRepository, NormalizedJobOffer } from '../application/ports.js';
import type { JobSource } from '../domain/enums.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { deduplicate } from './deduplicator.js';
import { normalizeJobOffer } from './normalizer.js';
import { SourceUnavailableError, type JobSourceConnector } from './types.js';

export interface SourceSyncSummary {
  readonly source: JobSource;
  readonly status: 'ok' | 'unavailable' | 'failed';
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
  readonly fetched: number;
  readonly inserted: number;
  readonly updated: number;
  readonly duplicates: number;
  readonly deactivated: number;
  readonly errors: number;
}

/**
 * Pipeline: Connector → RawJobOffer → Normalizer → Deduplicator → Repository.
 * Each source runs independently: one failing never stops the others, and a failed or
 * empty sync never deactivates existing offers (RN-008).
 */
export class JobSyncService {
  constructor(
    private readonly connectors: readonly JobSourceConnector[],
    private readonly jobs: JobOfferRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async syncAll(): Promise<SourceSyncSummary[]> {
    const summaries: SourceSyncSummary[] = [];
    for (const connector of this.connectors) {
      summaries.push(await this.syncSource(connector));
    }
    return summaries;
  }

  async syncSource(connector: JobSourceConnector): Promise<SourceSyncSummary> {
    const source = connector.source;
    const startedAt = this.clock.now();
    this.logger.info({ source, startedAt }, 'Job sync started');

    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let deactivated = 0;
    let errors = 0;
    let status: SourceSyncSummary['status'] = 'ok';

    try {
      const raw = await connector.fetchOffers();
      fetched = raw.length;
      const normalized: NormalizedJobOffer[] = [];
      for (const offer of raw) {
        try {
          normalized.push(normalizeJobOffer(offer));
        } catch (err) {
          errors += 1;
          this.logger.warn({ source, url: offer.sourceUrl, err }, 'Offer normalization failed');
        }
      }
      const deduped = deduplicate(normalized);
      duplicates = deduped.duplicates;

      for (const offer of deduped.unique) {
        try {
          const outcome = await this.jobs.upsert(offer, startedAt);
          if (outcome === 'inserted') inserted += 1;
          else updated += 1;
        } catch (err) {
          errors += 1;
          this.logger.warn({ source, url: offer.sourceUrl, err }, 'Offer persistence failed');
        }
      }
      if (deduped.unique.length > 0 && errors === 0) {
        deactivated = await this.jobs.markUnseenInactive(source, startedAt);
      }
    } catch (err) {
      errors += 1;
      status = err instanceof SourceUnavailableError ? 'unavailable' : 'failed';
      this.logger.error(
        { source, err: err instanceof Error ? err.message : err },
        status === 'unavailable' ? 'Source refused access; not retried' : 'Job sync failed',
      );
    }

    const finishedAt = this.clock.now();
    const summary: SourceSyncSummary = {
      source,
      status,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      fetched,
      inserted,
      updated,
      duplicates,
      deactivated,
      errors,
    };
    this.logger.info(summary, 'Job sync finished');
    return summary;
  }
}
