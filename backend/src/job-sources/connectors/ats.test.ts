import { describe, expect, it, vi } from 'vitest';
import { isArgentineLocation } from '../../domain/normalization/location.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { HttpClient, type FetchFn } from '../http-client.js';
import { normalizeJobOffer } from '../normalizer.js';
import { SourceUnavailableError, type RawJobOffer } from '../types.js';
import {
  createGreenhouseConnector,
  createLeverConnector,
  greenhouseLocation,
  isRelevantOffer,
  mapGreenhouseJob,
  mapLeverPosting,
  parseCompanies,
  type GreenhouseJob,
  type LeverPosting,
} from './ats.js';

const logger = createLogger('silent');
const NOW = new Date('2026-10-14T12:00:00Z');
const HTTP = {
  userAgent: 'TechMatchBot/test',
  timeoutMs: 1000,
  maxRetries: 0,
  minDelayMs: 0,
  backoffBaseMs: 1,
};
const DESPEGAR = { slug: 'despegar', name: 'Despegar' };
const CLARA = { slug: 'clara', name: 'Clara' };

function json(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const leverPosting = (overrides: Partial<LeverPosting> = {}): LeverPosting => ({
  id: 'abc-123',
  text: 'Backend Developer Java Semi Senior',
  hostedUrl: 'https://jobs.lever.co/despegar/abc-123',
  createdAt: Date.parse('2026-10-01T00:00:00Z'),
  workplaceType: 'hybrid',
  categories: { location: 'Buenos Aires', department: 'IT & UX', team: 'Backend' },
  description: '<p>Somos Despegar.</p>',
  lists: [
    {
      text: 'Requisitos',
      content: '<li>3 años de experiencia con Java y Spring Boot</li><li>PostgreSQL</li>',
    },
    { text: 'Deseable', content: '<li>Docker</li>' },
  ],
  ...overrides,
});

const greenhouseJob = (overrides: Partial<GreenhouseJob> = {}): GreenhouseJob => ({
  id: 42,
  title: 'Senior Software Engineer',
  absolute_url: 'https://job-boards.greenhouse.io/clara/jobs/42',
  first_published: '2026-09-20T10:00:00-03:00',
  location: { name: 'Remote - LATAM' },
  departments: [{ name: 'Engineering/ Builders' }],
  content:
    '&lt;h3&gt;Requirements&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;5+ years of experience with Go and Kubernetes&lt;/li&gt;&lt;/ul&gt;',
  ...overrides,
});

const offer = (overrides: Partial<RawJobOffer>): RawJobOffer => ({
  source: 'lever',
  sourceUrl: 'https://x',
  title: 'Backend Developer',
  location: 'Buenos Aires',
  modality: 'Híbrido',
  fetchedAt: NOW,
  ...overrides,
});

describe('company list configuration', () => {
  it('reads "slug:Nombre" and falls back to the slug', () => {
    expect(parseCompanies(['despegar:Despegar', ' kavak : Kavak ', 'acme'])).toEqual([
      { slug: 'despegar', name: 'Despegar' },
      { slug: 'kavak', name: 'Kavak' },
      { slug: 'acme', name: 'acme' },
    ]);
  });
});

describe('isArgentineLocation', () => {
  it('recognizes Argentina, CABA and provinces, also among several places', () => {
    for (const place of [
      'Buenos Aires',
      'CABA',
      'Córdoba, Argentina',
      'Argentina',
      'Bogota; Buenos Aires',
    ]) {
      expect(isArgentineLocation(place), place).toBe(true);
    }
    for (const place of [
      'Ciudad de México',
      'Sao Paulo / SP / Brazil',
      'Santiago, Chile',
      '',
      null,
    ]) {
      expect(isArgentineLocation(place), String(place)).toBe(false);
    }
  });
});

describe('relevance filter of company boards', () => {
  it('keeps technology roles that are remote or in Argentina', () => {
    expect(isRelevantOffer(offer({}), 'IT & UX')).toBe(true);
    expect(
      isRelevantOffer(offer({ location: 'Ciudad de México', modality: 'Remoto' }), 'Engineering'),
    ).toBe(true);
    // A tech title is enough when the area is not a tech one.
    expect(isRelevantOffer(offer({ title: 'Data Engineer' }), 'Finance')).toBe(true);
  });

  it('drops other areas and onsite or hybrid jobs abroad', () => {
    expect(isRelevantOffer(offer({ title: 'Ejecutivo de Ventas' }), 'Commercial')).toBe(false);
    expect(isRelevantOffer(offer({ location: 'Ciudad de México' }), 'Engineering')).toBe(false);
  });
});

describe('Lever', () => {
  it('maps a posting with its sections, so required and nice-to-have skills are told apart', () => {
    const { offer: raw, area } = mapLeverPosting(leverPosting(), DESPEGAR, NOW);
    expect(area).toBe('IT & UX');
    expect(raw).toMatchObject({
      source: 'lever',
      externalId: 'despegar:abc-123',
      company: 'Despegar',
      location: 'Buenos Aires',
      modality: 'Híbrido',
      sourceUrl: 'https://jobs.lever.co/despegar/abc-123',
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const normalized = normalizeJobOffer(raw);
    expect(normalized.modality).toBe('HYBRID');
    expect(normalized.experienceYearsMin).toBe(3);
    const skills = Object.fromEntries(normalized.skills.map((s) => [s.name, s.isRequired]));
    expect(skills).toMatchObject({
      Java: true,
      'Spring Boot': true,
      PostgreSQL: true,
      Docker: false,
    });
  });

  it('reads every configured company, keeps the relevant offers and skips missing boards', async () => {
    const fetchFn = vi.fn<FetchFn>((input) =>
      Promise.resolve(
        String(input).includes('/postings/despegar')
          ? json(200, [
              leverPosting(),
              leverPosting({
                id: 'v1',
                text: 'Ejecutivo Comercial',
                categories: { location: 'Buenos Aires', department: 'Commercial' },
              }),
            ])
          : json(404, { ok: false }),
      ),
    );
    const connector = createLeverConnector(
      new HttpClient('lever', HTTP, fetchFn),
      {
        apiUrl: 'https://api.lever.co/v0',
        companies: [DESPEGAR, { slug: 'no-existe', name: 'X' }],
        maxOffers: 100,
      },
      logger,
    );
    const offers = await connector.fetchOffers();
    expect(offers.map((o) => o.title)).toEqual(['Backend Developer Java Semi Senior']);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(
      'https://api.lever.co/v0/postings/despegar?mode=json',
    );
  });

  it('stops the sync when the source refuses access (so no offer is deactivated)', async () => {
    const connector = createLeverConnector(
      new HttpClient('lever', HTTP, vi.fn<FetchFn>().mockResolvedValue(json(403))),
      { apiUrl: 'https://api.lever.co/v0', companies: [DESPEGAR], maxOffers: 100 },
      logger,
    );
    await expect(connector.fetchOffers()).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});

describe('Greenhouse', () => {
  it('maps a job, decoding its escaped HTML content', () => {
    const { offer: raw, area } = mapGreenhouseJob(greenhouseJob(), CLARA, NOW);
    expect(area).toBe('Engineering/ Builders');
    expect(raw).toMatchObject({
      source: 'greenhouse',
      externalId: 'clara:42',
      company: 'Clara',
      modality: 'Remoto',
      location: 'Remote - LATAM',
    });
    expect(raw.requirements).toEqual([
      'Requirements',
      '5+ years of experience with Go and Kubernetes',
    ]);
    const normalized = normalizeJobOffer(raw);
    expect(normalized.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Go', 'Kubernetes']),
    );
    expect(normalized.experienceYearsMin).toBe(5);
  });

  it('keeps only the relevant jobs of the board', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(
      json(200, {
        jobs: [
          greenhouseJob(),
          greenhouseJob({ id: 43, location: { name: 'Mexico City / CDMX / Mexico' } }),
          greenhouseJob({
            id: 44,
            title: 'Account Executive',
            departments: [{ name: 'Sales/ GTM' }],
          }),
        ],
      }),
    );
    const connector = createGreenhouseConnector(
      new HttpClient('greenhouse', HTTP, fetchFn),
      { apiUrl: 'https://boards-api.greenhouse.io/v1', companies: [CLARA], maxOffers: 100 },
      logger,
    );
    const offers = await connector.fetchOffers();
    expect(offers.map((o) => o.externalId)).toEqual(['clara:42']);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(
      'https://boards-api.greenhouse.io/v1/boards/clara/jobs?content=true',
    );
  });
});

describe('Greenhouse locations', () => {
  it('picks the Argentine place and drops state codes, so a CV in Buenos Aires matches it', async () => {
    const { compareLocations, normalizeLocation } =
      await import('../../domain/normalization/location.js');
    const cv = normalizeLocation('Capital Federal, Buenos Aires');
    const several =
      'Bogota D.C. / DC / Colombia; Buenos Aires / C / Argentina; Mexico City / CDMX / Mexico';

    expect(greenhouseLocation('Buenos Aires / C / Argentina')).toBe('Buenos Aires, Argentina');
    expect(greenhouseLocation(several)).toBe('Buenos Aires, Argentina');
    expect(compareLocations(cv, normalizeLocation(greenhouseLocation(several)))).toBe(
      'SAME_REGION',
    );
    // Without an Argentine place, every place is kept (the offer is filtered out unless remote).
    expect(greenhouseLocation('Sao Paulo / SP / Brazil; Mexico City / CDMX / Mexico')).toBe(
      'Sao Paulo, Brazil; Mexico City, Mexico',
    );
    expect(greenhouseLocation(null)).toBeNull();
  });
});
