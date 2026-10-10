import { randomUUID } from 'node:crypto';
import type { NormalizedJobOffer } from '../src/application/ports.js';
import type { CandidateProfile, Cv, JobSkill } from '../src/domain/entities.js';
import { normalizeSkill } from '../src/domain/normalization/skills.js';

export function jobSkills(required: string[], optional: string[] = []): JobSkill[] {
  return [
    ...required.map((n) => ({ ...normalizeSkill(n)!, isRequired: true })),
    ...optional.map((n) => ({ ...normalizeSkill(n)!, isRequired: false })),
  ];
}

export function makeCv(overrides: Partial<Cv> = {}): Cv {
  const now = new Date();
  const id = overrides.id ?? randomUUID();
  return {
    id,
    originalFilename: 'cv.pdf',
    storagePath: `${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1234,
    extractedText: null,
    processingStatus: 'UPLOADED',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeProfile(
  cvId: string,
  overrides: Partial<CandidateProfile> = {},
): CandidateProfile {
  return {
    id: randomUUID(),
    cvId,
    summary: null,
    seniority: 'SEMI_SENIOR',
    totalExperienceYears: 3,
    location: 'CABA',
    projects: [],
    experiences: [
      {
        company: 'Acme',
        position: 'Backend Developer',
        description: null,
        startDate: '2022-03-01',
        endDate: null,
        years: 3,
        skills: [],
      },
    ],
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
    skills: ['Java', 'Spring', 'SQL'].map((n) => normalizeSkill(n)!),
    languages: [{ name: 'English', level: 'B2' }],
    ...overrides,
  };
}

let counter = 0;

export function makeOffer(overrides: Partial<NormalizedJobOffer> = {}): NormalizedJobOffer {
  counter += 1;
  return {
    externalId: `ext-${counter}`,
    source: 'getonboard',
    sourceUrl: `https://example.com/oferta/${counter}`,
    title: `Backend Developer ${counter}`,
    company: 'Empresa X',
    location: 'Capital Federal, Buenos Aires',
    modality: 'HYBRID',
    description: 'Buscamos desarrollador backend.',
    requirements: ['Java', 'Spring', '2 años de experiencia'],
    skills: jobSkills(['Java', 'Spring', 'SQL']),
    seniority: 'SEMI_SENIOR',
    experienceYearsMin: 2,
    educationRequirements: null,
    languageRequirements: [{ name: 'English', level: 'B2' }],
    publishedAt: null,
    ...overrides,
  };
}
