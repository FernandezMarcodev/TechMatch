import { describe, expect, it, vi } from 'vitest';
import { HYBRID_JOB, REMOTE_JOB, page } from '../../test/support/getonboard-fixture.js';
import type {
  JobOfferRepository,
  NormalizedJobOffer,
  UpsertOutcome,
} from '../application/ports.js';
import { createLogger } from '../infrastructure/logging/logger.js';
import { GetOnBoardConnector, mapGetOnBoardJob } from './connectors/getonboard.js';
import { deduplicate } from './deduplicator.js';
import { htmlToText } from './html.js';
import { HttpClient, type FetchFn } from './http-client.js';
import { normalizeJobOffer, parseExperienceYears } from './normalizer.js';
import { JobSyncService } from './sync-service.js';
import { SourceUnavailableError, type JobSourceConnector, type RawJobOffer } from './types.js';

const logger = createLogger('silent');
const NOW = new Date('2026-10-07T12:00:00Z');
const HTTP = {
  userAgent: 'TechMatchBot/test',
  timeoutMs: 1000,
  maxRetries: 2,
  minDelayMs: 0,
  backoffBaseMs: 1,
};

function raw(overrides: Partial<RawJobOffer> = {}): RawJobOffer {
  return {
    source: 'getonboard',
    sourceUrl: 'https://www.getonbrd.com/jobs/dev-1',
    title: 'Desarrollador Java Semi Senior',
    company: 'Acme S.A.',
    location: 'Buenos Aires, Argentina',
    fetchedAt: NOW,
    ...overrides,
  };
}

function json(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('mapGetOnBoardJob', () => {
  it('maps a hybrid job with city, seniority, tags and sections', () => {
    const offer = mapGetOnBoardJob(HYBRID_JOB, NOW);
    expect(offer).toMatchObject({
      source: 'getonboard',
      externalId: HYBRID_JOB.id,
      sourceUrl: HYBRID_JOB.links?.public_url,
      title: 'Backend Java Developer',
      company: 'Acme',
      location: 'Buenos Aires, Argentina',
      modality: 'Híbrido',
      seniority: 'Semi Senior',
      publishedAt: new Date(1790946882 * 1000),
      requirements: [
        'Obligatorios',
        '3+ años desarrollando con Java y Spring Boot.',
        'Experiencia con PostgreSQL.',
        'Inglés intermedio.',
      ],
      desirable: ['Conocimientos de Docker y Kubernetes.'],
    });
    // All declared tags are passed through; the normalizer decides which are optional.
    expect(offer.skills).toEqual(['Java', 'Spring Boot', 'PostgreSQL', 'Docker']);
    expect(offer.description).toContain('Responsabilidades\nDiseñar APIs REST.');
  });

  it('maps remote jobs without a location and translates "Expert"', () => {
    const offer = mapGetOnBoardJob(REMOTE_JOB, NOW);
    expect(offer).toMatchObject({
      modality: 'Remoto',
      location: null,
      seniority: 'Lead',
      company: 'Globex',
    });
  });
});

describe('normalizeJobOffer with Get on Board data', () => {
  const offer = normalizeJobOffer(mapGetOnBoardJob(HYBRID_JOB, NOW));

  it('produces the common model used by matching', () => {
    expect(offer).toMatchObject({
      modality: 'HYBRID',
      seniority: 'SEMI_SENIOR',
      experienceYearsMin: 3,
      languageRequirements: [{ name: 'English', level: 'B1' }],
    });
  });

  it('marks nice-to-have skills as optional', () => {
    const byName = Object.fromEntries(offer.skills.map((s) => [s.name, s.isRequired]));
    expect(byName).toMatchObject({
      Java: true,
      'Spring Boot': true,
      PostgreSQL: true,
      Docker: false,
      Kubernetes: false,
    });
  });

  it('ignores company history in the description when requirements are listed', () => {
    // "15 años de experiencia en el mercado" belongs to the company, not to the candidate.
    expect(offer.experienceYearsMin).toBe(3);
  });
});

describe('normalizeJobOffer', () => {
  it('derives modality from the explicit field, title or description', () => {
    expect(normalizeJobOffer(raw({ modality: 'Remoto' })).modality).toBe('REMOTE');
    expect(normalizeJobOffer(raw({ title: 'Dev Java - Híbrido' })).modality).toBe('HYBRID');
    expect(
      normalizeJobOffer(raw({ description: 'Modalidad: presencial en Palermo' })).modality,
    ).toBe('ONSITE');
    expect(normalizeJobOffer(raw()).modality).toBe('UNKNOWN');
  });

  it('takes the seniority from the title, then the declared field, and does not guess', () => {
    expect(normalizeJobOffer(raw()).seniority).toBe('SEMI_SENIOR');
    // "Senior" in the title wins over a broader declared category ("Expert" → Lead).
    expect(
      normalizeJobOffer(raw({ title: 'Senior Full-Stack Developer', seniority: 'Lead' })).seniority,
    ).toBe('SENIOR');
    expect(
      normalizeJobOffer(raw({ title: 'Desarrollador Java', seniority: 'Junior' })).seniority,
    ).toBe('JUNIOR');
    expect(normalizeJobOffer(raw({ title: 'Desarrollador Java' })).seniority).toBe('UNKNOWN');
  });

  it('separates required and optional skills in free text', () => {
    const offer = normalizeJobOffer(
      raw({
        title: 'Desarrollador Backend',
        requirements: ['Experiencia con Java', 'Deseable: Docker y Java'],
        skills: ['Postgres'],
      }),
    );
    expect(offer.skills).toEqual(
      expect.arrayContaining([
        { name: 'Java', normalizedName: 'java', isRequired: true },
        { name: 'PostgreSQL', normalizedName: 'postgresql', isRequired: true },
        { name: 'Docker', normalizedName: 'docker', isRequired: false },
      ]),
    );
  });

  it('treats lines under a nice-to-have heading as optional, including declared tags', () => {
    // Shape seen in real offers: the "deseables" are a heading inside the requirements.
    const offer = normalizeJobOffer(
      raw({
        title: 'Desarrollador Full Stack',
        requirements: [
          'Requisitos mínimos',
          'Experiencia con Node.js y Angular.',
          'Conocimientos deseables',
          'Docker y Kubernetes.',
          'Perfil',
          'Trabajo en equipo con Git.',
        ],
        skills: ['Node.js', 'Angular', 'Docker', 'Kubernetes'],
      }),
    );
    const byName = Object.fromEntries(offer.skills.map((s) => [s.name, s.isRequired]));
    expect(byName).toEqual({
      Angular: true,
      Docker: false,
      Git: true,
      Kubernetes: false,
      'Node.js': true,
    });
  });

  it('parses education requirements', () => {
    const offer = normalizeJobOffer(
      raw({ requirements: ['Estudiantes o graduados de Ingeniería en Sistemas'] }),
    );
    expect(offer.educationRequirements).toEqual({ level: 'UNIVERSITY', fields: ['Sistemas'] });
  });

  it.each([
    ['2+ años de experiencia', 2],
    ['Experiencia mínima de 4 años', 4],
    ['5 years of experience', 5],
    ['3 años desarrollando en Node', 3],
    ['sin requisitos', null],
  ])('parses experience years from "%s"', (text, years) => {
    expect(parseExperienceYears(text)).toBe(years);
  });

  it('never invents a company', () => {
    expect(normalizeJobOffer(raw({ company: null })).company).toBe('Empresa no especificada');
  });
});

describe('htmlToText', () => {
  it('converts HTML to text lines', () => {
    expect(htmlToText('<p>Hola <b>mundo</b></p><ul><li>Uno</li><li>Dos</li></ul>a<br>b')).toBe(
      'Hola mundo\nUno\nDos\na\nb',
    );
  });
});

describe('deduplicate', () => {
  it('drops in-batch duplicates by externalId, URL or source+title+company+location', () => {
    const base = normalizeJobOffer(raw({ externalId: '1' }));
    const sameId = { ...base, sourceUrl: 'https://other' };
    const sameUrl = { ...base, externalId: '2' };
    const sameFields = {
      ...base,
      externalId: '3',
      sourceUrl: 'https://third',
      title: base.title.toUpperCase(),
    };
    const different = {
      ...base,
      externalId: '4',
      sourceUrl: 'https://fourth',
      title: 'Otro puesto',
    };
    const result = deduplicate([base, sameId, sameUrl, sameFields, different]);
    expect(result.unique).toEqual([base, different]);
    expect(result.duplicates).toBe(3);
  });
});

describe('HttpClient', () => {
  it('identifies itself and parses JSON', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(200, { ok: true }));
    expect(await new HttpClient('getonboard', HTTP, fetchFn).getJson('https://x')).toEqual({
      ok: true,
    });
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toMatchObject({
      'User-Agent': 'TechMatchBot/test',
    });
  });

  it('reports refusals without retrying', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(429));
    await expect(
      new HttpClient('getonboard', HTTP, fetchFn).getJson('https://x'),
    ).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors a bounded number of times', async () => {
    const flaky = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(json(503))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    expect(await new HttpClient('getonboard', HTTP, flaky).getJson('https://x')).toEqual({ ok: 1 });

    const failing = vi.fn<FetchFn>().mockResolvedValue(json(500));
    await expect(new HttpClient('getonboard', HTTP, failing).getJson('https://x')).rejects.toThrow(
      'HTTP 500',
    );
    expect(failing).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors such as 404', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(404));
    await expect(new HttpClient('getonboard', HTTP, fetchFn).getJson('https://x')).rejects.toThrow(
      'HTTP 404',
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('GetOnBoardConnector', () => {
  function connector(
    fetchFn: FetchFn,
    maxOffers = 10,
    categories = ['programming', 'data-science-analytics'],
  ) {
    return new GetOnBoardConnector(
      new HttpClient('getonboard', HTTP, fetchFn),
      { apiUrl: 'https://api.test/v0', categories, perPage: 2, maxOffers },
      logger,
      () => NOW,
    );
  }

  it('walks categories and pages, skipping jobs seen in another category', async () => {
    const fetchFn = vi.fn<FetchFn>((input) => {
      const url = new URL(String(input));
      const p = url.searchParams.get('page');
      if (url.pathname.endsWith('/programming/jobs')) {
        return Promise.resolve(
          json(200, p === '1' ? page([HYBRID_JOB], 1, 2) : page([REMOTE_JOB], 2, 2)),
        );
      }
      return Promise.resolve(json(200, page([HYBRID_JOB], 1, 1)));
    });
    const offers = await connector(fetchFn).fetchOffers();
    expect(offers.map((o) => o.externalId)).toEqual([HYBRID_JOB.id, REMOTE_JOB.id]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    const firstUrl = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(firstUrl.searchParams.get('per_page')).toBe('2');
    expect(JSON.parse(firstUrl.searchParams.get('expand') ?? '[]')).toEqual(
      expect.arrayContaining(['company', 'tags', 'seniority', 'location_cities']),
    );
  });

  it('stops at maxOffers', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValue(json(200, page([HYBRID_JOB, REMOTE_JOB], 1, 5)));
    const offers = await connector(fetchFn, 1).fetchOffers();
    expect(offers).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('propagates refusals so the sync reports the source as unavailable', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(json(403));
    await expect(connector(fetchFn).fetchOffers()).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});

class InMemoryJobs implements JobOfferRepository {
  readonly upserted: NormalizedJobOffer[] = [];
  readonly deactivations: string[] = [];
  findById = () => Promise.resolve(null);
  findActive = () => Promise.resolve([]);
  upsert(offer: NormalizedJobOffer): Promise<UpsertOutcome> {
    const existed = this.upserted.some((o) => o.sourceUrl === offer.sourceUrl);
    this.upserted.push(offer);
    return Promise.resolve(existed ? 'updated' : 'inserted');
  }
  markUnseenInactive(source: string): Promise<number> {
    this.deactivations.push(source);
    return Promise.resolve(0);
  }
}

function fakeConnector(fetchOffers: () => Promise<RawJobOffer[]>): JobSourceConnector {
  return { source: 'getonboard', fetchOffers };
}

describe('JobSyncService', () => {
  const clock = { now: () => NOW };

  it('runs connectors independently: one failing does not stop the next', async () => {
    const jobs = new InMemoryJobs();
    const service = new JobSyncService(
      [
        fakeConnector(() => Promise.reject(new SourceUnavailableError('getonboard', 403))),
        fakeConnector(() =>
          Promise.resolve([
            raw({ sourceUrl: 'https://z/1', externalId: '1' }),
            raw({ sourceUrl: 'https://z/1', externalId: '1' }),
            raw({ sourceUrl: 'https://z/2', externalId: '2', title: 'Otro' }),
          ]),
        ),
      ],
      jobs,
      clock,
      logger,
    );
    const [first, second] = await service.syncAll();
    expect(first).toMatchObject({ status: 'unavailable', fetched: 0, errors: 1 });
    expect(second).toMatchObject({ status: 'ok', fetched: 3, inserted: 2, duplicates: 1 });
    expect(jobs.deactivations).toEqual(['getonboard']);
  });

  it('never deactivates offers after a failed or empty sync', async () => {
    const jobs = new InMemoryJobs();
    const service = new JobSyncService(
      [
        fakeConnector(() => Promise.reject(new Error('boom'))),
        fakeConnector(() => Promise.resolve([])),
      ],
      jobs,
      clock,
      logger,
    );
    const summaries = await service.syncAll();
    expect(summaries.map((s) => s.status)).toEqual(['failed', 'ok']);
    expect(jobs.deactivations).toEqual([]);
  });
});
