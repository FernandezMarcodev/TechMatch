import { describe, expect, it } from 'vitest';
import type { CandidateProfile, JobOffer, JobSkill } from '../domain/entities.js';
import { normalizeSkill } from '../domain/normalization/skills.js';
import { buildAdaptedDraft } from './draft-builder.js';

function skills(...names: string[]) {
  return names.map((n) => normalizeSkill(n)!);
}

function jobSkills(required: string[], optional: string[] = []): JobSkill[] {
  return [
    ...skills(...required).map((s) => ({ ...s, isRequired: true })),
    ...skills(...optional).map((s) => ({ ...s, isRequired: false })),
  ];
}

function profile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'p1',
    cvId: 'cv1',
    summary: 'Resumen original del CV.',
    seniority: 'SEMI_SENIOR',
    totalExperienceYears: 7.1,
    location: 'Capital Federal, Buenos Aires',
    experiences: [
      {
        company: 'Globant',
        position: 'Desarrolladora Junior',
        description: 'Mantenimiento de aplicaciones Node.js y MySQL.',
        startDate: '2019-01-01',
        endDate: '2021-02-01',
        years: 2.1,
        skills: [],
      },
      {
        company: 'Acme S.A.',
        position: 'Desarrolladora Backend',
        description:
          'Coordinación con el equipo de producto.\nDesarrollo de microservicios con Java y Spring Boot.',
        startDate: '2021-03-01',
        endDate: null,
        years: 5,
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
    skills: skills('Java', 'Spring Boot', 'Git', 'Docker', 'MySQL', 'Node.js'),
    languages: [{ name: 'English', level: 'B1' }],
    ...overrides,
  };
}

function job(overrides: Partial<JobOffer> = {}): JobOffer {
  const now = new Date('2026-10-01T00:00:00Z');
  return {
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
    skills: jobSkills(['Java', 'Spring Boot', 'Kubernetes'], ['Docker', 'TypeScript']),
    seniority: 'SEMI_SENIOR',
    experienceYearsMin: 3,
    educationRequirements: null,
    languageRequirements: [{ name: 'English', level: 'B2' }],
    publishedAt: null,
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
    ...overrides,
  };
}

describe('buildAdaptedDraft — never invents', () => {
  const { document } = buildAdaptedDraft(profile(), job());

  it('contains only technologies from the CV', () => {
    const names = document.skills.map((s) => s.name);
    expect(names).not.toContain('Kubernetes');
    expect(names).not.toContain('TypeScript');
    expect(names.sort()).toEqual(['Docker', 'Git', 'Java', 'MySQL', 'Node.js', 'Spring Boot']);
  });

  it('keeps languages, experiences and education as extracted', () => {
    expect(document.languages).toEqual([{ name: 'Inglés', level: 'B1' }]);
    expect(document.experiences).toHaveLength(2);
    expect(document.education).toEqual([
      {
        degree: 'Ingeniería en Sistemas de Información',
        institution: 'UTN',
        startDate: '2013',
        endDate: '2019',
      },
    ]);
  });

  it('leaves personal data for the user to fill in', () => {
    expect(document.personal).toEqual({
      fullName: '',
      headline: 'Desarrolladora Backend',
      email: '',
      phone: '',
      location: 'Capital Federal, Buenos Aires',
      links: [],
    });
  });
});

describe('buildAdaptedDraft — ordering and highlighting', () => {
  const { document } = buildAdaptedDraft(profile(), job());

  it('orders technologies: matching required, matching optional, rest', () => {
    expect(document.skills).toEqual([
      { name: 'Java', highlighted: true },
      { name: 'Spring Boot', highlighted: true },
      { name: 'Docker', highlighted: true },
      { name: 'Git', highlighted: false },
      { name: 'MySQL', highlighted: false },
      { name: 'Node.js', highlighted: false },
    ]);
  });

  it('lists experiences most recent first, marking the relevant ones', () => {
    expect(
      document.experiences.map((e) => [e.company, e.startDate, e.endDate, e.relevant]),
    ).toEqual([
      ['Acme S.A.', '2021-03', null, true],
      ['Globant', '2019-01', '2021-02', false],
    ]);
  });

  it('puts highlight lines that mention the offer first', () => {
    expect(document.experiences[0]?.highlights).toEqual([
      'Desarrollo de microservicios con Java y Spring Boot.',
      'Coordinación con el equipo de producto.',
    ]);
  });
});

describe('buildAdaptedDraft — summary', () => {
  it('uses title, seniority, years and matching technologies', () => {
    expect(buildAdaptedDraft(profile(), job()).document.summary).toBe(
      'Desarrolladora Backend Semi Senior con 7 años de experiencia en Java, Spring Boot y Docker.',
    );
  });

  it('does not repeat the seniority already in the title', () => {
    const p = profile({
      experiences: [{ ...profile().experiences[1]!, position: 'Desarrolladora Semi Senior' }],
    });
    expect(buildAdaptedDraft(p, job()).document.summary).toBe(
      'Desarrolladora Semi Senior con 7 años de experiencia en Java, Spring Boot y Docker.',
    );
  });

  it('omits missing parts instead of inventing them', () => {
    const p = profile({ seniority: 'UNKNOWN', totalExperienceYears: null });
    expect(buildAdaptedDraft(p, job()).document.summary).toBe(
      'Desarrolladora Backend con experiencia en Java, Spring Boot y Docker.',
    );
  });

  it('falls back to the CV summary when nothing matches and years are unknown', () => {
    const p = profile({ totalExperienceYears: null, skills: skills('Excel') });
    expect(buildAdaptedDraft(p, job()).document.summary).toBe('Resumen original del CV.');
  });

  it('uses a neutral title when there is no experience', () => {
    const p = profile({ experiences: [], summary: null, totalExperienceYears: null, skills: [] });
    expect(buildAdaptedDraft(p, job()).document.summary).toBe('Profesional Semi Senior.');
  });
});

describe('buildAdaptedDraft — suggestions', () => {
  it('suggests missing required and optional technologies', () => {
    const { suggestions } = buildAdaptedDraft(profile(), job());
    expect(suggestions.filter((s) => s.skill)).toEqual([
      {
        type: 'MISSING_REQUIRED_SKILL',
        skill: 'Kubernetes',
        message: 'La oferta pide Kubernetes. Si tenés experiencia, agregala.',
      },
      {
        type: 'MISSING_OPTIONAL_SKILL',
        skill: 'TypeScript',
        message: 'Suma conocer TypeScript (deseable). Si lo manejás, agregalo.',
      },
    ]);
  });

  it('suggests improving or stating languages', () => {
    const lower = buildAdaptedDraft(profile(), job()).suggestions.find(
      (s) => s.type === 'LANGUAGE',
    );
    expect(lower?.message).toBe(
      'La oferta pide inglés B2 y tu CV indica B1. Si tu nivel es mayor, actualizalo.',
    );
    const missing = buildAdaptedDraft(profile({ languages: [] }), job()).suggestions.find(
      (s) => s.type === 'LANGUAGE',
    );
    expect(missing?.message).toBe(
      'La oferta pide inglés B2. Si lo manejás, indicalo con tu nivel.',
    );
    const noLevel = buildAdaptedDraft(
      profile({ languages: [{ name: 'English', level: null }] }),
      job(),
    ).suggestions.find((s) => s.type === 'LANGUAGE');
    expect(noLevel?.message).toBe('Indicá tu nivel de inglés: la oferta pide B2.');
  });

  it('points out less experience than required', () => {
    const { suggestions } = buildAdaptedDraft(
      profile({ totalExperienceYears: 2 }),
      job({ experienceYearsMin: 5 }),
    );
    expect(suggestions).toContainEqual({
      type: 'EXPERIENCE',
      message:
        'La oferta pide 5 años de experiencia y tu CV indica 2 años. Destacá los proyectos más relevantes.',
    });
  });

  it('flags data the CV did not let us detect', () => {
    const { suggestions } = buildAdaptedDraft(
      profile({ seniority: 'UNKNOWN', totalExperienceYears: null, education: [] }),
      job({ educationRequirements: { level: 'UNIVERSITY', fields: [] } }),
    );
    expect(suggestions.filter((s) => s.type === 'MISSING_DATA').map((s) => s.message)).toEqual([
      'La oferta pide 3 años de experiencia y no pudimos calcular la tuya: revisá las fechas de tus trabajos.',
      'La oferta busca un perfil Semi Senior y no pudimos detectar tu seniority. Indicalo en tu título.',
      'La oferta pide formación de nivel universitario. Si la tenés, agregala en Educación.',
    ]);
  });

  it('has no suggestions when the CV already covers the offer', () => {
    const { suggestions } = buildAdaptedDraft(
      profile({ languages: [{ name: 'English', level: 'C1' }] }),
      job({ skills: jobSkills(['Java'], ['Docker']) }),
    );
    expect(suggestions).toEqual([]);
  });

  it('is deterministic', () => {
    expect(buildAdaptedDraft(profile(), job())).toEqual(buildAdaptedDraft(profile(), job()));
  });
});
