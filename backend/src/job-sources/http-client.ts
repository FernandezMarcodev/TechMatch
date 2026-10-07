import type { JobSource } from '../domain/enums.js';
import { SourceUnavailableError } from './types.js';

export interface HttpClientOptions {
  readonly userAgent: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  /** Minimum delay between consecutive requests (rate limiting). */
  readonly minDelayMs: number;
  readonly backoffBaseMs: number;
}

export type FetchFn = typeof fetch;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const REFUSED_STATUSES = new Set([401, 403, 429]);

class NonRetryableError extends Error {}

/**
 * HTTP client for source APIs: identifies itself, applies timeouts, spaces requests and
 * retries transient failures a bounded number of times with exponential backoff. A refusal
 * (401/403/429) is reported as SourceUnavailableError and never retried.
 */
export class HttpClient {
  private lastRequestAt = 0;

  constructor(
    private readonly source: JobSource,
    private readonly options: HttpClientOptions,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async getJson<T>(url: string): Promise<T> {
    let attempt = 0;
    for (;;) {
      await this.waitTurn();
      try {
        const res = await this.fetchFn(url, {
          headers: { 'User-Agent': this.options.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (REFUSED_STATUSES.has(res.status))
          throw new SourceUnavailableError(this.source, res.status);
        if (res.status >= 500) throw new Error(`HTTP ${res.status} for ${url}`);
        if (!res.ok) throw new NonRetryableError(`HTTP ${res.status} for ${url}`);
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof SourceUnavailableError || err instanceof NonRetryableError) throw err;
        if (attempt >= this.options.maxRetries) throw err;
        attempt += 1;
        await sleep(this.options.backoffBaseMs * 2 ** (attempt - 1));
      }
    }
  }

  private async waitTurn(): Promise<void> {
    const wait = this.lastRequestAt + this.options.minDelayMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }
}
