import type { Logger } from '../../infrastructure/logging/logger.js';
import { htmlToText } from '../html.js';
import type { HttpClient } from '../http-client.js';
import type { JobSourceConnector, RawJobOffer } from '../types.js';

/** Subset of the Get on Board public API (v0) job resource that TechMatch uses. */
export interface GetOnBoardJob {
  readonly id: string;
  readonly attributes: {
    readonly title: string;
    readonly description?: string | null;
    readonly projects?: string | null;
    readonly functions_headline?: string | null;
    readonly functions?: string | null;
    readonly benefits_headline?: string | null;
    readonly benefits?: string | null;
    readonly desirable?: string | null;
    readonly remote?: boolean;
    readonly remote_modality?: string | null;
    readonly countries?: readonly string[];
    readonly published_at?: number | null;
    readonly seniority?: { data?: { attributes?: { name?: string } } | null };
    readonly tags?: { data?: readonly { attributes?: { name?: string } }[] };
    readonly company?: { data?: { attributes?: { name?: string } } | null };
    readonly location_cities?: {
      data?: readonly { attributes?: { name?: string; country?: string } }[];
    };
  };
  readonly links?: { readonly public_url?: string };
}

export interface GetOnBoardPage {
  readonly data: readonly GetOnBoardJob[];
  readonly meta?: { readonly page?: number; readonly total_pages?: number };
}

export interface GetOnBoardOptions {
  /** e.g. https://www.getonbrd.com/api/v0 */
  readonly apiUrl: string;
  /** Category ids, e.g. programming, data-science-analytics. */
  readonly categories: readonly string[];
  readonly perPage: number;
  readonly maxOffers: number;
}

const MODALITY_TEXT: Readonly<Record<string, string>> = {
  fully_remote: 'Remoto',
  remote_local: 'Remoto',
  hybrid: 'Híbrido',
  no_remote: 'Presencial',
};

// Get on Board seniority names that our keyword detection would not recognize.
const SENIORITY_TEXT: Readonly<Record<string, string>> = {
  'sin experiencia': 'Trainee',
  'no experience': 'Trainee',
  expert: 'Lead',
  experto: 'Lead',
};

function lines(html: string | null | undefined): string[] {
  return html ? htmlToText(html).split('\n').filter(Boolean) : [];
}

function locationOf(job: GetOnBoardJob, isRemote: boolean): string | null {
  const city = job.attributes.location_cities?.data?.[0]?.attributes;
  if (city?.name && !isRemote) return [city.name, city.country].filter(Boolean).join(', ');
  const countries = (job.attributes.countries ?? []).filter((c) => c.toLowerCase() !== 'remote');
  return countries.length > 0 ? countries.join(', ') : null;
}

/** Maps one API job to the source-independent RawJobOffer. Pure; tested without network. */
export function mapGetOnBoardJob(job: GetOnBoardJob, fetchedAt: Date): RawJobOffer {
  const a = job.attributes;
  const modality = a.remote_modality ? (MODALITY_TEXT[a.remote_modality] ?? null) : null;
  const isRemote = modality === 'Remoto' || (modality === null && a.remote === true);
  const requirements = lines(a.description);
  const desirable = lines(a.desirable);

  // Tags are the skills the publisher declared; the normalizer decides which are optional.
  const tags = (a.tags?.data ?? [])
    .map((t) => t.attributes?.name)
    .filter((n): n is string => Boolean(n));

  const seniorityName = a.seniority?.data?.attributes?.name ?? null;
  const description = [
    ...lines(a.projects),
    ...(a.functions ? [a.functions_headline || 'Responsabilidades', ...lines(a.functions)] : []),
    ...(a.benefits ? [a.benefits_headline || 'Beneficios', ...lines(a.benefits)] : []),
  ].join('\n');

  return {
    source: 'getonboard',
    sourceUrl: job.links?.public_url ?? `https://www.getonbrd.com/jobs/${job.id}`,
    externalId: job.id,
    title: a.title,
    company: a.company?.data?.attributes?.name ?? null,
    location: locationOf(job, isRemote),
    modality: isRemote ? 'Remoto' : modality,
    description,
    requirements,
    desirable,
    skills: tags,
    seniority: seniorityName
      ? (SENIORITY_TEXT[seniorityName.toLowerCase()] ?? seniorityName)
      : null,
    publishedAt: a.published_at ? new Date(a.published_at * 1000) : null,
    fetchedAt,
  };
}

const EXPAND = encodeURIComponent(
  JSON.stringify(['company', 'tags', 'seniority', 'location_cities']),
);

/**
 * Reads offers from the Get on Board public API (https://www.getonbrd.com/api-docs),
 * category by category, page by page, up to `maxOffers`.
 */
export class GetOnBoardConnector implements JobSourceConnector {
  readonly source = 'getonboard' as const;

  constructor(
    private readonly http: HttpClient,
    private readonly options: GetOnBoardOptions,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchOffers(): Promise<RawJobOffer[]> {
    const { apiUrl, categories, perPage, maxOffers } = this.options;
    const byId = new Map<string, RawJobOffer>();

    for (const category of categories) {
      let totalPages = 1;
      for (let page = 1; page <= totalPages && byId.size < maxOffers; page++) {
        const url = `${apiUrl}/categories/${encodeURIComponent(category)}/jobs?per_page=${perPage}&page=${page}&expand=${EXPAND}`;
        const body = await this.http.getJson<GetOnBoardPage>(url);
        totalPages = body.meta?.total_pages ?? 1;
        for (const job of body.data) {
          if (byId.size >= maxOffers) break;
          try {
            if (!byId.has(job.id)) byId.set(job.id, mapGetOnBoardJob(job, this.now()));
          } catch (err) {
            this.logger.warn(
              { source: this.source, jobId: job.id, err },
              'Offer could not be mapped',
            );
          }
        }
      }
    }
    return [...byId.values()];
  }
}
