import { describe, expect, it } from 'vitest';
import type { CandidateProfile, CriterionName, JobOffer, JobSkill } from '../domain/entities.js';
import { normalizeSkill } from '../domain/normalization/skills.js';
import { DEFAULT_MATCHING_CONFIG, parseMatchingConfig } from './matching-config.js';
import { classify, evaluateMatch } from './matching-engine.js';

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

function profile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'p1',
    cvId: 'cv1',
    summary: null,
    seniority: 'SEMI_SENIOR',
    totalExperienceYears: 3,
    location: 'CABA',
    experiences: [],
    education: [
      {
        institution: 'UTN',
        degree: 'Ingeniería en Sistemas',
        field: 'Sistemas',
        level: 'UNIVERSITY',
        startDate: null,
        endDate: null,
      },
    ],
    skills: skills('Java', 'Spring', 'SQL'),
    languages: [{ name: 'English', level: 'C1' }],
    ...overrides,
  };
}

function job(overrides: Partial<JobOffer> = {}): JobOffer {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'j1',
    externalId: 'ext-1',
    source: 'getonboard',
    sourceUrl: 'https://example.com/job/1',
    title: 'Backend Developer',
    company: 'Empresa X',
    location: 'Capital Federal, Buenos Aires',
    modality: 'HYBRID',
    description: '',
    requirements: [],
    skills: jobSkills(['Java', 'Spring', 'SQL']),
    seniority: 'SEMI_SENIOR',
    experienceYearsMin: 2,
    educationRequirements: { level: 'UNIVERSITY', fields: ['Sistemas'] },
    languageRequirements: [{ name: 'English', level: 'B2' }],
    publishedAt: null,
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
    ...overrides,
  };
}

function criterion(result: ReturnType<typeof evaluateMatch>, name: CriterionName) {
  const found = result.criteria.find((c) => c.criterion === name);
  if (!found) throw new Error(`criterion ${name} missing`);
  return found;
}

describe('evaluateMatch — levels', () => {
  it('perfect match scores 100 / HIGH', () => {
    const result = evaluateMatch(profile(), job(), config);
    expect(result.score).toBe(100);
    expect(result.level).toBe('HIGH');
    expect(result.reasons.every((r) => r.status !== 'negative')).toBe(true);
  });

  it('high match with one missing skill', () => {
    const result = evaluateMatch(
      profile({ skills: skills('Java', 'Spring', 'SQL', 'Docker') }),
      job({ skills: jobSkills(['Java', 'Spring', 'SQL', 'Docker', 'Kubernetes']) }),
      config,
    );
    // skills 80 * 0.35 + 65 = 93
    expect(result.score).toBe(93);
    expect(result.level).toBe('HIGH');
    expect(criterion(result, 'skills').evidence).toContain(
      'Coinciden 4 de 5 tecnologías requeridas',
    );
    expect(criterion(result, 'skills').evidence).toContain('faltan: Kubernetes');
  });

  it('medium match', () => {
    const result = evaluateMatch(
      profile({ skills: skills('Java', 'SQL'), seniority: 'JUNIOR', totalExperienceYears: 1 }),
      job({ skills: jobSkills(['Java', 'SQL', 'Spring', 'Docker']) }),
      config,
    );
    // skills 50*.35 + seniority 60*.25 + experience 50*.20 + rest 100*.20 = 62.5
    expect(result.score).toBe(63);
    expect(result.level).toBe('MEDIUM');
  });

  it('low match', () => {
    const result = evaluateMatch(
      profile({ skills: skills('PHP'), seniority: 'INTERN', totalExperienceYears: 0.5 }),
      job({
        skills: jobSkills(['Java', 'Spring', 'SQL']),
        seniority: 'SENIOR',
        experienceYearsMin: 5,
      }),
      config,
    );
    // skills 0 + seniority 20*.25 + experience 10*.20 + rest 100*.20 = 27
    expect(result.score).toBe(27);
    expect(result.level).toBe('LOW');
  });

  it('classifies with configured thresholds', () => {
    expect(classify(49, config)).toBe('LOW');
    expect(classify(50, config)).toBe('MEDIUM');
    expect(classify(74, config)).toBe('MEDIUM');
    expect(classify(75, config)).toBe('HIGH');
    const strict = { ...config, thresholds: { medium: 60, high: 90 } };
    expect(classify(80, strict)).toBe('MEDIUM');
  });
});

describe('evaluateMatch — skills', () => {
  it('partial skills score proportionally', () => {
    const result = evaluateMatch(
      profile({ skills: skills('Java') }),
      job({ skills: jobSkills(['Java', 'Spring']) }),
      config,
    );
    expect(criterion(result, 'skills').score).toBe(50);
  });

  it('matches aliases (JS, Postgres, Node)', () => {
    const result = evaluateMatch(
      profile({ skills: skills('JS', 'Postgres', 'node') }),
      job({ skills: jobSkills(['JavaScript', 'PostgreSQL', 'Node.js']) }),
      config,
    );
    expect(criterion(result, 'skills').score).toBe(100);
  });

  it('weights required skills above optional ones', () => {
    const result = evaluateMatch(
      profile({ skills: skills('Java', 'Docker') }),
      job({ skills: jobSkills(['Java', 'Spring'], ['Docker']) }),
      config,
    );
    // (2 + 1) / (2 + 2 + 1) = 60
    expect(criterion(result, 'skills').score).toBe(60);
    expect(criterion(result, 'skills').evidence).toBe(
      'Coinciden 1 de 2 tecnologías requeridas (Java); faltan: Spring; 1 de 1 deseables (Docker)',
    );
  });
});

describe('evaluateMatch — experience and seniority', () => {
  it('more experience than required is not penalized', () => {
    const result = evaluateMatch(profile({ totalExperienceYears: 8 }), job(), config);
    expect(criterion(result, 'experience').score).toBe(100);
    expect(criterion(result, 'experience').status).toBe('positive');
  });

  it('less experience scores proportionally', () => {
    const result = evaluateMatch(
      profile({ totalExperienceYears: 1 }),
      job({ experienceYearsMin: 4 }),
      config,
    );
    const exp = criterion(result, 'experience');
    expect(exp.score).toBe(25);
    expect(exp.status).toBe('negative');
    expect(exp.evidence).toBe('La oferta requiere 4 años y el CV indica 1 año');
  });

  it('no experience requirement is a match for any experience level', () => {
    const result = evaluateMatch(
      profile({ totalExperienceYears: 0 }),
      job({ experienceYearsMin: null }),
      config,
    );
    expect(criterion(result, 'experience').score).toBe(100);
    expect(criterion(result, 'experience').status).toBe('positive');
    expect(criterion(result, 'experience').evidence).toBe('La oferta no exige años de experiencia');

    const experienced = evaluateMatch(
      profile({ totalExperienceYears: 7 }),
      job({ experienceYearsMin: null }),
      config,
    );
    expect(criterion(experienced, 'experience')).toMatchObject({
      score: 100,
      status: 'positive',
      evidence: 'La oferta no exige años de experiencia; el CV indica 7 años',
    });
  });

  it('compatible seniority', () => {
    const result = evaluateMatch(
      profile({ seniority: 'SENIOR' }),
      job({ seniority: 'SENIOR' }),
      config,
    );
    expect(criterion(result, 'seniority').score).toBe(100);
  });

  it('one level apart is partial, far apart is low', () => {
    const near = evaluateMatch(profile({ seniority: 'JUNIOR' }), job(), config);
    expect(criterion(near, 'seniority').score).toBe(60);
    const far = evaluateMatch(profile({ seniority: 'INTERN' }), job({ seniority: 'LEAD' }), config);
    expect(criterion(far, 'seniority').score).toBe(20);
    expect(criterion(far, 'seniority').status).toBe('negative');
  });
});

describe('evaluateMatch — priorities', () => {
  it('weights technologies > seniority > experience > the rest', () => {
    const w = config.weights;
    expect(w.skills).toBeGreaterThan(w.seniority);
    expect(w.seniority).toBeGreaterThan(w.experience);
    for (const other of [w.education, w.languages, w.location, w.modality]) {
      expect(w.experience).toBeGreaterThan(other);
    }
  });

  it('a seniority gap costs more than an equal experience gap', () => {
    // Seniority one level apart (60) vs. experience at 60% of the requirement (60).
    const seniorityGap = evaluateMatch(profile({ seniority: 'JUNIOR' }), job(), config);
    const experienceGap = evaluateMatch(
      profile({ totalExperienceYears: 3 }),
      job({ experienceYearsMin: 5 }),
      config,
    );
    expect(seniorityGap.score).toBeLessThan(experienceGap.score);
  });
});

describe('evaluateMatch — education without a stated requirement', () => {
  const edu = (
    degree: string,
    level: 'SECONDARY' | 'TERTIARY' | 'UNIVERSITY' | 'POSTGRADUATE',
  ) => ({
    institution: null,
    degree,
    field: null,
    level,
    startDate: null,
    endDate: null,
  });
  const noRequirement = job({ educationRequirements: null });

  it.each([
    ['Ingeniería en Sistemas de Información', 'UNIVERSITY', 100, 'afín a informática'],
    ['Licenciatura en Ciencias de la Computación', 'UNIVERSITY', 100, 'afín a informática'],
    ['Ingeniería Industrial', 'UNIVERSITY', 75, 'base general'],
    ['Licenciatura en Administración', 'UNIVERSITY', 75, 'base general'],
    ['Tecnicatura en Programación', 'TERTIARY', 85, 'afín a informática'],
    ['Tecnicatura en Turismo', 'TERTIARY', 50, 'Formación terciaria'],
    ['Bachiller', 'SECONDARY', 40, 'secundario'],
  ] as const)('values "%s" (%s) at %i', (degree, level, expected, text) => {
    const result = evaluateMatch(
      profile({ education: [edu(degree, level)] }),
      noRequirement,
      config,
    );
    expect(criterion(result, 'education').score).toBe(expected);
    expect(criterion(result, 'education').evidence).toContain(text);
  });

  it('keeps the best of several degrees', () => {
    const result = evaluateMatch(
      profile({
        education: [edu('Bachiller', 'SECONDARY'), edu('Ingeniería en Informática', 'UNIVERSITY')],
      }),
      noRequirement,
      config,
    );
    expect(criterion(result, 'education').score).toBe(100);
  });

  it('a computing degree ranks the same offer higher than an unrelated one', () => {
    const computing = evaluateMatch(
      profile({ education: [edu('Ingeniería en Sistemas', 'UNIVERSITY')] }),
      noRequirement,
      config,
    );
    const other = evaluateMatch(
      profile({ education: [edu('Licenciatura en Letras', 'UNIVERSITY')] }),
      noRequirement,
      config,
    );
    expect(computing.score).toBeGreaterThan(other.score);
  });

  it('is unknown (not penalized) when the CV states no education', () => {
    const result = evaluateMatch(profile({ education: [] }), noRequirement, config);
    expect(criterion(result, 'education').score).toBeNull();
  });

  it('accepts any computing field when the offer asks for one', () => {
    const result = evaluateMatch(
      profile({ education: [edu('Licenciatura en Ciencias de la Computación', 'UNIVERSITY')] }),
      job({ educationRequirements: { level: 'UNIVERSITY', fields: ['Informática'] } }),
      config,
    );
    expect(criterion(result, 'education').score).toBe(100);
    expect(criterion(result, 'education').evidence).toContain('el área de estudio coincide');
  });
});

describe('evaluateMatch — missing information (UNKNOWN is neither match nor mismatch)', () => {
  it('unknown candidate data is excluded and its weight redistributed', () => {
    const result = evaluateMatch(
      profile({ seniority: 'UNKNOWN', totalExperienceYears: null }),
      job(),
      config,
    );
    expect(criterion(result, 'seniority').score).toBeNull();
    expect(criterion(result, 'seniority').effectiveWeight).toBe(0);
    expect(criterion(result, 'experience').score).toBeNull();
    expect(result.score).toBe(100);
    const total = result.criteria.reduce((s, c) => s + c.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('missing education is unknown, not a failure', () => {
    const result = evaluateMatch(profile({ education: [] }), job(), config);
    expect(criterion(result, 'education').score).toBeNull();
    expect(criterion(result, 'education').status).toBe('unknown');
    expect(result.score).toBe(100);
  });

  it('missing languages are unknown, not a failure', () => {
    const result = evaluateMatch(profile({ languages: [] }), job(), config);
    expect(criterion(result, 'languages').score).toBeNull();
    expect(result.score).toBe(100);
  });

  it('a stated but insufficient language level is penalized', () => {
    const result = evaluateMatch(
      profile({ languages: [{ name: 'English', level: 'A2' }] }),
      job({ languageRequirements: [{ name: 'English', level: 'C1' }] }),
      config,
    );
    // (A2 rank 2) / (C1 rank 5) = 40
    expect(criterion(result, 'languages').score).toBe(40);
    expect(criterion(result, 'languages').evidence).toContain('inglés C1');
  });

  it('a native level meets any requirement and is shown as "nativo"', () => {
    const result = evaluateMatch(
      profile({ languages: [{ name: 'English', level: 'NATIVE' }] }),
      job({ languageRequirements: [{ name: 'English', level: 'C2' }] }),
      config,
    );
    expect(criterion(result, 'languages').score).toBe(100);
    expect(criterion(result, 'languages').evidence).toBe('Inglés nativo cumple el nivel C2');
  });

  it('an offer without comparable skills is never recommended', () => {
    const result = evaluateMatch(profile(), job({ skills: [] }), config);
    expect(result.level).toBe('LOW');
    expect(criterion(result, 'skills').status).toBe('unknown');
    expect(result.reasons.find((r) => r.criterion === 'skills')?.message).toContain(
      'no especifica tecnologías',
    );
  });

  it('is never recommended when the technology match is below the configured minimum', () => {
    // 1 of 4 skills = 25 (< 40). Every other criterion is perfect: 25*.35 + 65 = 74 → would be MEDIUM.
    const result = evaluateMatch(
      profile(),
      job({ skills: jobSkills(['Java', 'React', 'Angular', 'Kubernetes']) }),
      config,
    );
    expect(result.score).toBe(74);
    expect(result.level).toBe('LOW');
    expect(criterion(result, 'skills').status).toBe('negative');

    const lenient = { ...config, criterionMinimums: {} };
    expect(
      evaluateMatch(
        profile(),
        job({ skills: jobSkills(['Java', 'React', 'Angular', 'Kubernetes']) }),
        lenient,
      ).level,
    ).toBe('MEDIUM');
  });

  it('is never recommended when the seniority is two or more levels away', () => {
    // Junior CV vs. Senior offer: seniority 20, but perfect skills would still reach MEDIUM.
    const gap = evaluateMatch(
      profile({ seniority: 'JUNIOR' }),
      job({ seniority: 'SENIOR' }),
      config,
    );
    expect(criterion(gap, 'seniority').score).toBe(20);
    expect(gap.score).toBeGreaterThanOrEqual(config.thresholds.medium);
    expect(gap.level).toBe('LOW');
    expect(gap.reasons.find((r) => r.criterion === 'seniority')).toEqual({
      criterion: 'seniority',
      status: 'negative',
      message: 'La oferta busca Senior y el CV indica Junior',
    });

    // One level away (Junior vs. Semi Senior) can still be recommended.
    const near = evaluateMatch(profile({ seniority: 'JUNIOR' }), job(), config);
    expect(near.level).not.toBe('LOW');

    // An unknown seniority on either side is not a mismatch.
    expect(
      evaluateMatch(profile({ seniority: 'UNKNOWN' }), job({ seniority: 'SENIOR' }), config).level,
    ).not.toBe('LOW');
  });

  it('an offer with only skills stated does not penalize other criteria', () => {
    const result = evaluateMatch(
      profile(),
      job({
        experienceYearsMin: null,
        educationRequirements: null,
        languageRequirements: [],
        seniority: 'UNKNOWN',
        modality: 'UNKNOWN',
        location: null,
      }),
      config,
    );
    expect(result.score).toBe(100);
    expect(result.level).toBe('HIGH');
  });
});

describe('evaluateMatch — location and modality', () => {
  it('remote job is compatible regardless of city', () => {
    const result = evaluateMatch(
      profile({ location: 'Rosario, Santa Fe' }),
      job({ modality: 'REMOTE', location: 'Capital Federal, Buenos Aires' }),
      config,
    );
    expect(criterion(result, 'location').score).toBe(100);
    expect(criterion(result, 'modality').score).toBe(100);
  });

  it('onsite job in another region is incompatible', () => {
    const result = evaluateMatch(
      profile({ location: 'CABA' }),
      job({ modality: 'ONSITE', location: 'Rosario, Santa Fe' }),
      config,
    );
    expect(criterion(result, 'modality').score).toBe(0);
    expect(criterion(result, 'modality').status).toBe('negative');
    expect(criterion(result, 'location').score).toBe(0);
    // Otherwise a perfect match, but the candidate cannot commute: never recommended.
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe('LOW');
  });

  it('a hybrid job in another country is not recommended either', () => {
    const result = evaluateMatch(
      profile({ location: 'CABA' }),
      job({ modality: 'HYBRID', location: 'Santiago, Chile' }),
      config,
    );
    expect(result.level).toBe('LOW');
  });

  it('a remote job abroad is still recommended', () => {
    const result = evaluateMatch(
      profile({ location: 'CABA' }),
      job({ modality: 'REMOTE', location: 'Santiago, Chile' }),
      config,
    );
    expect(result.level).toBe('HIGH');
  });

  it('same region is partially compatible', () => {
    const result = evaluateMatch(
      profile({ location: 'CABA' }),
      job({ location: 'Vicente López, Buenos Aires' }),
      config,
    );
    expect(criterion(result, 'location').score).toBe(70);
    expect(criterion(result, 'modality').score).toBe(100);
  });

  it('unknown candidate location does not assume compatibility', () => {
    const result = evaluateMatch(profile({ location: null }), job(), config);
    expect(criterion(result, 'location').score).toBeNull();
    expect(criterion(result, 'modality').score).toBeNull();
  });
});

describe('evaluateMatch — explanations and determinism', () => {
  it('produces one reason per criterion, derived from the same evaluation', () => {
    const result = evaluateMatch(profile({ totalExperienceYears: 1 }), job(), config);
    expect(result.reasons).toHaveLength(7);
    for (const reason of result.reasons) {
      expect(reason.message).toBe(criterion(result, reason.criterion).evidence);
    }
  });

  it('is deterministic for identical input and config', () => {
    const a = evaluateMatch(profile(), job({ skills: jobSkills(['Java', 'Docker']) }), config);
    const b = evaluateMatch(profile(), job({ skills: jobSkills(['Java', 'Docker']) }), config);
    expect(a).toEqual(b);
  });

  it('always yields a score within 0–100', () => {
    const result = evaluateMatch(
      profile({ skills: skills('Excel'), totalExperienceYears: 0, seniority: 'INTERN' }),
      job({ seniority: 'MANAGER', experienceYearsMin: 10 }),
      config,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('matching config', () => {
  it('rejects weights that do not add up to 1', () => {
    expect(() =>
      parseMatchingConfig({ ...config, weights: { ...config.weights, skills: 0.5 } }),
    ).toThrow(/add up to 1/);
  });

  it('accepts the default config', () => {
    expect(parseMatchingConfig(config)).toEqual(config);
  });
});
