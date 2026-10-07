import type { GetOnBoardJob, GetOnBoardPage } from '../../src/job-sources/connectors/getonboard.js';

/**
 * Synthetic jobs with the shape of the Get on Board public API v0 response
 * (GET /categories/:id/jobs?expand=["company","tags","seniority","location_cities"]),
 * as observed on 2026-10-07. Values are invented.
 */
export const HYBRID_JOB: GetOnBoardJob = {
  id: 'backend-java-developer-acme-buenos-aires-a1b2',
  attributes: {
    title: 'Backend Java Developer',
    description:
      '<p><strong>Obligatorios</strong></p><ul><li>3+ años desarrollando con Java y Spring Boot.</li><li>Experiencia con PostgreSQL.</li><li>Inglés intermedio.</li></ul>',
    projects:
      '<p>Acme es una empresa con más de 15 años de experiencia en el mercado financiero.</p>',
    functions_headline: 'Responsabilidades',
    functions: '<ul><li>Diseñar APIs REST.</li><li>Participar en code reviews.</li></ul>',
    benefits_headline: 'Beneficios',
    benefits: '<p>Modalidad híbrida, 2 días en oficina.</p>',
    desirable: '<ul><li>Conocimientos de Docker y Kubernetes.</li></ul>',
    remote: false,
    remote_modality: 'hybrid',
    countries: ['Argentina'],
    published_at: 1790946882,
    seniority: { data: { attributes: { name: 'Semi Senior' } } },
    tags: {
      data: [
        { attributes: { name: 'Java' } },
        { attributes: { name: 'Spring Boot' } },
        { attributes: { name: 'PostgreSQL' } },
        { attributes: { name: 'Docker' } },
      ],
    },
    company: { data: { attributes: { name: 'Acme' } } },
    location_cities: { data: [{ attributes: { name: 'Buenos Aires', country: 'Argentina' } }] },
  },
  links: {
    public_url: 'https://www.getonbrd.com/jobs/backend-java-developer-acme-buenos-aires-a1b2',
  },
};

export const REMOTE_JOB: GetOnBoardJob = {
  id: 'senior-react-developer-globex-remote',
  attributes: {
    title: 'React Developer',
    description: '<ul><li>5 años de experiencia con React y TypeScript.</li></ul>',
    remote: true,
    remote_modality: 'fully_remote',
    countries: ['Remote'],
    published_at: 1790900000,
    seniority: { data: { attributes: { name: 'Expert' } } },
    tags: { data: [{ attributes: { name: 'React' } }, { attributes: { name: 'TypeScript' } }] },
    company: { data: { attributes: { name: 'Globex' } } },
    location_cities: { data: [] },
  },
  links: { public_url: 'https://www.getonbrd.com/jobs/senior-react-developer-globex-remote' },
};

export function page(
  data: GetOnBoardJob[],
  pageNumber: number,
  totalPages: number,
): GetOnBoardPage {
  return { data, meta: { page: pageNumber, total_pages: totalPages } };
}
