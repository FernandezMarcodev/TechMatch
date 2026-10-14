import { isArgentineLocation } from '../../domain/normalization/location.js';
import { foldText } from '../../domain/text.js';
import type { Logger } from '../../infrastructure/logging/logger.js';
import { htmlToText } from '../html.js';
import { HttpStatusError, type HttpClient } from '../http-client.js';
import type { JobSourceConnector, RawJobOffer } from '../types.js';

/**
 * Public job board APIs of applicant tracking systems (Lever, Greenhouse): each company
 * publishes its openings through an unauthenticated, read-only API meant to show them on
 * other sites (docs/05-FUENTES-DE-OFERTAS.md). There is one board per company.
 */

/** A company's board: its id in the ATS and the name to show ("despegar:Despegar"). */
export interface AtsCompany {
  readonly slug: string;
  readonly name: string;
}

export function parseCompanies(entries: readonly string[]): AtsCompany[] {
  return entries.map((entry) => {
    const [slug = '', name] = entry.split(':').map((s) => s.trim());
    return { slug, name: name || slug };
  });
}

// Areas and titles of technology roles (folded: no accents, lowercase).
const TECH_AREA = /\b(engineering|tecnologia|technology|it|data|desarrollo|software|builders|ux)\b/;
const TECH_TITLE =
  /\b(developer|desarrollador|engineer|ingenier[oa]|devops|sre|qa|tester|programador|data|arquitect[oa]|architect|frontend|backend|full ?stack|mobile)\b/;

/**
 * Company boards list every area and country: keep only technology roles (by area or
 * title) that are remote or in Argentina. An onsite job abroad is never recommended.
 */
export function isRelevantOffer(offer: RawJobOffer, area: string | null): boolean {
  const isTech = TECH_AREA.test(foldText(area ?? '')) || TECH_TITLE.test(foldText(offer.title));
  const isRemote = /remot/.test(foldText(offer.modality ?? ''));
  return isTech && (isRemote || isArgentineLocation(offer.location ?? null));
}

function lines(html: string | null | undefined): string[] {
  return html ? htmlToText(html).split('\n').filter(Boolean) : [];
}

// ---------- Lever: https://api.lever.co/v0/postings/{company}?mode=json ----------

export interface LeverPosting {
  readonly id: string;
  readonly text: string;
  readonly hostedUrl: string;
  readonly createdAt?: number;
  readonly workplaceType?: string | null;
  readonly categories?: {
    readonly location?: string | null;
    readonly department?: string | null;
    readonly team?: string | null;
  };
  readonly description?: string | null;
  readonly lists?: readonly { readonly text?: string; readonly content?: string }[];
  readonly additional?: string | null;
}

const LEVER_MODALITY: Readonly<Record<string, string>> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
};

/** Maps one Lever posting; `area` feeds the relevance filter. Pure. */
export function mapLeverPosting(
  posting: LeverPosting,
  company: AtsCompany,
  fetchedAt: Date,
): { offer: RawJobOffer; area: string | null } {
  // Lever lists are the offer's sections ("Requisitos", "Deseable"...): the normalizer tells
  // required from nice-to-have by their headings.
  const listLines = (posting.lists ?? []).flatMap((list) => [
    ...(list.text ? [list.text] : []),
    ...lines(list.content),
  ]);
  return {
    area: posting.categories?.department ?? posting.categories?.team ?? null,
    offer: {
      source: 'lever',
      sourceUrl: posting.hostedUrl,
      externalId: `${company.slug}:${posting.id}`,
      title: posting.text,
      company: company.name,
      location: posting.categories?.location ?? null,
      modality: LEVER_MODALITY[posting.workplaceType ?? ''] ?? null,
      description: [...lines(posting.description), ...lines(posting.additional)].join('\n'),
      requirements: listLines,
      publishedAt: posting.createdAt ? new Date(posting.createdAt) : null,
      fetchedAt,
    },
  };
}

// ---------- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{company}/jobs ----------

export interface GreenhouseJob {
  readonly id: number;
  readonly title: string;
  readonly absolute_url: string;
  readonly first_published?: string | null;
  readonly location?: { readonly name?: string | null } | null;
  readonly departments?: readonly { readonly name?: string | null }[];
  /** HTML, escaped once more (&lt;p&gt;). */
  readonly content?: string | null;
}

/**
 * Greenhouse writes "City / STATE / Country" and separates several places with ";"
 * ("Bogota D.C. / DC / Colombia; Buenos Aires / C / Argentina"). For the matching: the
 * Argentine place when there is one, as "City, Country" (state codes would be read as
 * provinces).
 */
export function greenhouseLocation(raw: string | null): string | null {
  if (!raw) return null;
  const places = raw.split(';').map((place) =>
    place
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !/^[A-Z]{1,4}$/.test(part))
      .join(', '),
  );
  return places.find((place) => isArgentineLocation(place)) ?? places.join('; ');
}

/** Maps one Greenhouse job; `area` feeds the relevance filter. Pure. */
export function mapGreenhouseJob(
  job: GreenhouseJob,
  company: AtsCompany,
  fetchedAt: Date,
): { offer: RawJobOffer; area: string | null } {
  // The content arrives escaped: decoding it once gives the HTML.
  const html = htmlToText(job.content ?? '');
  const location = greenhouseLocation(job.location?.name ?? null);
  return {
    area: job.departments?.[0]?.name ?? null,
    offer: {
      source: 'greenhouse',
      sourceUrl: job.absolute_url,
      externalId: `${company.slug}:${job.id}`,
      title: job.title,
      company: company.name,
      location,
      // Greenhouse has no modality field: "Remote" in the location is the usual signal.
      modality: /remot/i.test(location ?? '') ? 'Remoto' : null,
      description: '',
      requirements: lines(html),
      publishedAt: job.first_published ? new Date(job.first_published) : null,
      fetchedAt,
    },
  };
}

// ---------- Connector ----------

interface AtsConnectorOptions<T> {
  readonly source: 'lever' | 'greenhouse';
  readonly companies: readonly AtsCompany[];
  readonly boardUrl: (company: AtsCompany) => string;
  readonly listJobs: (body: unknown) => readonly T[];
  readonly map: (
    item: T,
    company: AtsCompany,
    fetchedAt: Date,
  ) => {
    offer: RawJobOffer;
    area: string | null;
  };
  readonly maxOffers: number;
}

/** Reads every configured company's board and keeps the relevant offers. */
export class AtsConnector<T> implements JobSourceConnector {
  readonly source: 'lever' | 'greenhouse';

  constructor(
    private readonly http: HttpClient,
    private readonly options: AtsConnectorOptions<T>,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.source = options.source;
  }

  async fetchOffers(): Promise<RawJobOffer[]> {
    const { companies, boardUrl, listJobs, map, maxOffers } = this.options;
    const offers: RawJobOffer[] = [];
    for (const company of companies) {
      let body: unknown;
      try {
        body = await this.http.getJson<unknown>(boardUrl(company));
      } catch (err) {
        // A company that is not (or no longer) on this ATS is a configuration problem:
        // skip it. Any other failure stops the sync, which then deactivates nothing.
        if (err instanceof HttpStatusError && err.status === 404) {
          this.logger.warn(
            { source: this.source, company: company.slug },
            'Company board not found',
          );
          continue;
        }
        throw err;
      }
      let kept = 0;
      for (const item of listJobs(body)) {
        if (offers.length >= maxOffers) break;
        const { offer, area } = map(item, company, this.now());
        if (isRelevantOffer(offer, area)) {
          offers.push(offer);
          kept += 1;
        }
      }
      this.logger.info({ source: this.source, company: company.slug, kept }, 'Company board read');
    }
    return offers;
  }
}

export function createLeverConnector(
  http: HttpClient,
  options: { apiUrl: string; companies: readonly AtsCompany[]; maxOffers: number },
  logger: Logger,
): AtsConnector<LeverPosting> {
  return new AtsConnector<LeverPosting>(
    http,
    {
      source: 'lever',
      companies: options.companies,
      boardUrl: (c) => `${options.apiUrl}/postings/${encodeURIComponent(c.slug)}?mode=json`,
      listJobs: (body) => (Array.isArray(body) ? (body as LeverPosting[]) : []),
      map: mapLeverPosting,
      maxOffers: options.maxOffers,
    },
    logger,
  );
}

export function createGreenhouseConnector(
  http: HttpClient,
  options: { apiUrl: string; companies: readonly AtsCompany[]; maxOffers: number },
  logger: Logger,
): AtsConnector<GreenhouseJob> {
  return new AtsConnector<GreenhouseJob>(
    http,
    {
      source: 'greenhouse',
      companies: options.companies,
      boardUrl: (c) => `${options.apiUrl}/boards/${encodeURIComponent(c.slug)}/jobs?content=true`,
      listJobs: (body) => (body as { jobs?: GreenhouseJob[] } | null)?.jobs ?? [],
      map: mapGreenhouseJob,
      maxOffers: options.maxOffers,
    },
    logger,
  );
}
