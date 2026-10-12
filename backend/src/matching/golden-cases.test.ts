/**
 * Golden cases: realistic CV + offer pairs with the level a person would expect. Each case
 * runs the real pipeline (CV text extraction → offer normalization → matching engine with
 * the default config), so a change in weights, thresholds, the skill catalog or the
 * extractors that alters a human-obvious outcome makes this test fail.
 */
import { describe, expect, it } from 'vitest';
import type { JobOffer } from '../domain/entities.js';
import type { MatchLevel } from '../domain/enums.js';
import { extractProfile } from '../cv-processing/profile-extractor.js';
import { normalizeJobOffer } from '../job-sources/normalizer.js';
import type { RawJobOffer } from '../job-sources/types.js';
import { DEFAULT_MATCHING_CONFIG } from './matching-config.js';
import { evaluateMatch } from './matching-engine.js';

const TODAY = new Date('2026-06-01T00:00:00Z');

const CVS = {
  /** Semi senior backend, Java/Spring, 5 years, CABA, English C1. */
  backendJava: [
    'María Fernández',
    'Desarrolladora Backend Semi Senior',
    'maria.fernandez@example.com | Capital Federal, Buenos Aires',
    'Experiencia laboral',
    'Desarrolladora Backend Semi Senior - Acme S.A.',
    'Marzo 2021 - Actualidad',
    'Desarrollo de microservicios con Java, Spring Boot y PostgreSQL.',
    'Despliegues con Docker en AWS.',
    'Desarrolladora Junior | Globant',
    'Enero 2019 - Febrero 2021',
    'Mantenimiento de aplicaciones Node.js y MySQL.',
    'Educación',
    'Ingeniería en Sistemas de Información - Universidad Tecnológica Nacional',
    '2013 - 2019',
    'Idiomas',
    'Inglés: avanzado (C1)',
    'Habilidades',
    'Java, Spring, SQL, Git, REST, Scrum',
  ],
  /** Junior frontend, React/TypeScript, 1 year, Córdoba, English B1. */
  frontendJunior: [
    'Lucas Gómez',
    'Desarrollador Frontend Junior',
    'lucas.gomez@example.com | Córdoba, Argentina',
    'Experiencia laboral',
    'Desarrollador Frontend Junior - Startup SRL',
    'Junio 2025 - Actualidad',
    'Desarrollo de interfaces con React, TypeScript y CSS.',
    'Educación',
    'Tecnicatura en Programación - Universidad Tecnológica Nacional',
    '2022 - 2024',
    'Idiomas',
    'Inglés: intermedio (B1)',
    'Habilidades',
    'React, TypeScript, JavaScript, HTML, CSS, Git',
  ],
  /** Senior .NET, 8 years, Rosario, English B2. */
  dotnetSenior: [
    'Ana Pérez',
    'Desarrolladora .NET Senior',
    'ana.perez@example.com | Rosario, Santa Fe',
    'Experiencia laboral',
    'Desarrolladora .NET Senior - Banco Ejemplo',
    'Enero 2018 - Actualidad',
    'APIs REST con C#, ASP.NET Core, EF Core y SQL Server.',
    'Pruebas unitarias con xUnit y despliegues con Azure DevOps.',
    'Educación',
    'Licenciatura en Sistemas - Universidad Nacional de Rosario',
    '2012 - 2017',
    'Idiomas',
    'Inglés: intermedio-avanzado (B2)',
    'Habilidades',
    'C#, .NET, SQL Server, Azure, Git',
  ],
} satisfies Record<string, string[]>;

function offer(raw: Omit<RawJobOffer, 'source' | 'sourceUrl' | 'fetchedAt'>): JobOffer {
  const normalized = normalizeJobOffer({
    source: 'getonboard',
    sourceUrl: 'https://example.com/jobs/1',
    fetchedAt: TODAY,
    ...raw,
  });
  return { ...normalized, id: 'job', firstSeenAt: TODAY, lastSeenAt: TODAY, isActive: true };
}

interface GoldenCase {
  readonly name: string;
  readonly cv: readonly string[];
  readonly job: JobOffer;
  readonly expected: MatchLevel;
  /** Expected technology match (%), when the case is about recognizing technologies. */
  readonly skillsScore?: number;
}

const CASES: readonly GoldenCase[] = [
  {
    name: 'backend Java semi senior → backend Java semi senior remote offer',
    cv: CVS.backendJava,
    job: offer({
      title: 'Backend Developer Java Semi Senior',
      company: 'Fintech SA',
      location: 'Buenos Aires, Argentina',
      modality: 'Remoto',
      requirements: [
        '3+ años de experiencia con Java y Spring Boot',
        'Experiencia con PostgreSQL y Docker',
        'Inglés intermedio',
      ],
      skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'],
      seniority: 'Semi Senior',
    }),
    expected: 'HIGH',
  },
  {
    name: 'backend Java → frontend React offer (different technologies)',
    cv: CVS.backendJava,
    job: offer({
      title: 'Frontend Developer Semi Senior',
      modality: 'Remoto',
      requirements: ['Experiencia con React, Redux y TypeScript', 'Manejo de CSS y HTML'],
      skills: ['React', 'Redux', 'TypeScript', 'CSS'],
      seniority: 'Semi Senior',
    }),
    expected: 'LOW',
  },
  {
    name: 'backend Java → onsite offer in another country',
    cv: CVS.backendJava,
    job: offer({
      title: 'Backend Developer Java Semi Senior',
      location: 'Santiago, Chile',
      modality: 'Presencial',
      requirements: ['Experiencia con Java, Spring Boot y PostgreSQL'],
      skills: ['Java', 'Spring Boot', 'PostgreSQL'],
      seniority: 'Semi Senior',
    }),
    expected: 'LOW',
  },
  {
    name: 'frontend junior → frontend React junior remote offer',
    cv: CVS.frontendJunior,
    job: offer({
      title: 'Desarrollador Frontend Junior',
      modality: 'Remoto',
      requirements: ['Conocimientos de React y TypeScript', 'HTML y CSS'],
      skills: ['React', 'TypeScript', 'HTML', 'CSS'],
      seniority: 'Junior',
    }),
    expected: 'HIGH',
  },
  {
    name: 'frontend junior → senior backend offer (two seniority levels away)',
    cv: CVS.frontendJunior,
    job: offer({
      title: 'Senior Backend Engineer',
      modality: 'Remoto',
      requirements: ['5+ años de experiencia con Java y Spring', 'Kafka y microservicios'],
      skills: ['Java', 'Spring', 'Kafka', 'Microservices'],
      seniority: 'Senior',
    }),
    expected: 'LOW',
  },
  {
    name: 'frontend junior → senior React offer (right stack, too senior)',
    cv: CVS.frontendJunior,
    job: offer({
      title: 'Senior React Developer',
      modality: 'Remoto',
      requirements: ['5+ años de experiencia con React y TypeScript'],
      skills: ['React', 'TypeScript'],
      seniority: 'Senior',
    }),
    expected: 'LOW',
  },
  {
    name: '.NET senior → .NET senior offer with Get on Board tags (EF Core, unit testing)',
    cv: CVS.dotnetSenior,
    job: offer({
      title: 'Senior .NET Developer',
      location: 'Argentina',
      modality: 'Remoto',
      requirements: ['5+ años de experiencia en .NET', 'Inglés intermedio-avanzado'],
      skills: ['C#', '.NET', 'Entity Framework Core', 'SQL Server', 'Unit Testing'],
      seniority: 'Senior',
    }),
    expected: 'HIGH',
    // "EF Core" and "Pruebas unitarias" in the CV are the offer's tags in other words.
    skillsScore: 100,
  },
  {
    name: '.NET senior → Java semi senior offer (different stack)',
    cv: CVS.dotnetSenior,
    job: offer({
      title: 'Backend Developer Java',
      modality: 'Remoto',
      requirements: ['Experiencia con Java, Spring Boot y Kafka'],
      skills: ['Java', 'Spring Boot', 'Kafka'],
      seniority: 'Semi Senior',
    }),
    expected: 'LOW',
  },
];

describe('golden cases: CV + offer → expected level', () => {
  it.each(CASES)('$name → $expected', ({ cv, job, expected, skillsScore }) => {
    const profile = { ...extractProfile(cv.join('\n'), TODAY), id: 'profile', cvId: 'cv' };
    const result = evaluateMatch(profile, job, DEFAULT_MATCHING_CONFIG);
    // On failure, the reasons show why the engine decided otherwise.
    const reasons = result.reasons.map((r) => `${r.status}: ${r.message}`).join('\n');
    expect(result.level, reasons).toBe(expected);
    if (skillsScore !== undefined) {
      expect(result.criteria.find((c) => c.criterion === 'skills')?.score, reasons).toBe(
        skillsScore,
      );
    }
  });
});
