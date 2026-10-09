import { describe, expect, it } from 'vitest';
import type { CandidateProfile, JobOffer, JobSkill } from '../domain/entities.js';
import { normalizeSkill } from '../domain/normalization/skills.js';
import { DEFAULT_MATCHING_CONFIG } from '../matching/matching-config.js';
import { evaluateMatch } from '../matching/matching-engine.js';
import { evaluationDocumentSchema } from './document-schema.js';
import { documentToProfile } from './document-to-profile.js';
import { buildAdaptedDraft } from './draft-builder.js';

const NOW = new Date('2026-03-01T00:00:00Z');
const config = DEFAULT_MATCHING_CONFIG;

function skills(...names: string[]) {
  return names.map((n) => normalizeSkill(n)!);
}

function jobSkills(required: string[], optional: string[] = []): JobSkill[] {
  return [
    ...skills(...required).map((s) => ({ ...s, isRequired: true })),
    ...skills(...optional).map((s) => ({ ...s, isRequired: false })),
  ];
}

const profile: CandidateProfile = {
  id: 'p1',
  cvId: 'cv1',
  summary: null,
  seniority: 'SEMI_SENIOR',
  totalExperienceYears: 7.1,
  location: 'Capital Federal, Buenos Aires',
  experiences: [
    {
      company: 'Acme S.A.',
      position: 'Desarrolladora Backend Semi Senior',
      description: 'Microservicios con Java, Spring Boot y PostgreSQL.',
      startDate: '2021-03-01',
      endDate: null,
      years: 5,
      skills: [],
    },
    {
      company: 'Globant',
      position: 'Desarrolladora Junior',
      description: 'Mantenimiento de aplicaciones Node.js y MySQL.',
      startDate: '2019-01-01',
      endDate: '2021-02-01',
      years: 2.1,
      skills: [],
    },
  ],
  education: [
    {
      institution: 'UTN',
      degree: 'Ingeniería en Sistemas de Información',
      field: 'Sistemas de Información',
      level: 'UNIVERSITY',
      startDate: '2013-06-01',
      endDate: '2019-06-01',
    },
  ],
  // As CV processing would extract them: every technology mentioned in the text.
  skills: skills(
    'Java',
    'Spring',
    'Spring Boot',
    'Microservices',
    'PostgreSQL',
    'Node.js',
    'MySQL',
    'Git',
  ),
  languages: [{ name: 'English', level: 'C1' }],
};

const now = new Date('2026-02-01T00:00:00Z');
const job: JobOffer = {
  id: 'j1',
  externalId: 'x',
  source: 'getonboard',
  sourceUrl: 'https://example.com/job',
  title: 'Backend Developer',
  company: 'Empresa X',
  location: null,
  modality: 'REMOTE',
  description: '',
  requirements: [],
  skills: jobSkills(['Java', 'Spring Boot', 'Kubernetes', 'TypeScript']),
  seniority: 'SEMI_SENIOR',
  experienceYearsMin: 3,
  educationRequirements: null,
  languageRequirements: [{ name: 'English', level: 'B2' }],
  publishedAt: null,
  firstSeenAt: now,
  lastSeenAt: now,
  isActive: true,
};

/** The draft as the browser would send it back (validated by the same schema). */
function sentBack(document = buildAdaptedDraft(profile, job).document) {
  return evaluationDocumentSchema.parse(document);
}

const ids = { id: 'p1', cvId: 'cv1' };

describe('documentToProfile — round trip', () => {
  const back = documentToProfile(sentBack(), ids, NOW);

  it('keeps technologies, seniority, years, education and languages', () => {
    expect(back.skills.map((s) => s.name).sort()).toEqual(profile.skills.map((s) => s.name).sort());
    expect(back.seniority).toBe('SEMI_SENIOR');
    expect(back.totalExperienceYears).toBe(7.1);
    expect(back.education[0]).toMatchObject({
      level: 'UNIVERSITY',
      field: 'Sistemas de Información',
    });
    expect(back.languages).toEqual([{ name: 'English', level: 'C1' }]);
    expect(back.location).toBe('Capital Federal, Buenos Aires');
  });

  it('evaluates to the same result as the original CV', () => {
    expect(evaluateMatch(back, job, config)).toEqual(evaluateMatch(profile, job, config));
  });
});

describe('documentToProfile — edits', () => {
  it('a confirmed missing technology improves the technologies criterion', () => {
    const draft = buildAdaptedDraft(profile, job).document;
    const edited = sentBack({
      ...draft,
      skills: [...draft.skills, { name: 'Kubernetes', highlighted: true }],
    });
    const before = evaluateMatch(profile, job, config);
    const after = evaluateMatch(documentToProfile(edited, ids, NOW), job, config);
    const skillsScore = (r: typeof before) =>
      r.criteria.find((c) => c.criterion === 'skills')?.score;
    expect(skillsScore(after)).toBeGreaterThan(skillsScore(before) ?? 0);
  });

  it('reads seniority and language names as written in the editor', () => {
    const draft = buildAdaptedDraft(profile, job).document;
    const back = documentToProfile(
      sentBack({
        ...draft,
        personal: { ...draft.personal, headline: 'Desarrolladora Senior' },
        languages: [
          { name: 'Inglés', level: 'b2' },
          { name: 'Klingon', level: 'X9' },
        ],
      }),
      ids,
      NOW,
    );
    expect(back.seniority).toBe('SENIOR');
    expect(back.languages).toEqual([
      { name: 'English', level: 'B2' },
      { name: 'Klingon', level: null },
    ]);
  });

  it('never invents: an empty document yields an empty profile', () => {
    const back = documentToProfile(
      sentBack({
        personal: { fullName: '', headline: null, email: '', phone: '', location: null, links: [] },
        summary: '',
        experiences: [],
        education: [],
        skills: [],
        languages: [],
      }),
      ids,
      NOW,
    );
    expect(back).toMatchObject({
      seniority: 'UNKNOWN',
      totalExperienceYears: null,
      location: null,
      skills: [],
      education: [],
      languages: [],
    });
  });
});

describe('evaluationDocumentSchema', () => {
  it('drops personal identifying data', () => {
    const parsed = sentBack({
      ...buildAdaptedDraft(profile, job).document,
      personal: {
        fullName: 'María Fernández',
        headline: 'Dev',
        email: 'maria@example.com',
        phone: '123',
        location: null,
        links: ['https://linkedin.com/in/maria'],
      },
    });
    expect(parsed.personal).toEqual({ headline: 'Dev', location: null });
  });

  it('rejects malformed dates and oversized documents', () => {
    const draft = buildAdaptedDraft(profile, job).document;
    const badDate = {
      ...draft,
      experiences: [{ ...draft.experiences[0]!, startDate: 'marzo 2021' }],
    };
    expect(evaluationDocumentSchema.safeParse(badDate).success).toBe(false);
    const tooMany = {
      ...draft,
      skills: Array.from({ length: 101 }, (_, i) => ({ name: `S${i}` })),
    };
    expect(evaluationDocumentSchema.safeParse(tooMany).success).toBe(false);
  });
});
