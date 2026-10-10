import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdaptedDraft } from '../api/client';
import { App } from '../App';
import { storageKey } from './AdaptCvPage';

const draft: AdaptedDraft = {
  job: { id: 'job-1', title: 'Backend Developer', company: 'Empresa X' },
  document: {
    personal: {
      fullName: '',
      headline: 'Desarrolladora Backend',
      email: '',
      phone: '',
      location: 'Capital Federal, Buenos Aires',
      links: [],
    },
    summary: 'Desarrolladora Backend Semi Senior con 7 años de experiencia en Java.',
    experiences: [
      {
        position: 'Desarrolladora Backend',
        company: 'Acme S.A.',
        startDate: '2021-03',
        endDate: null,
        highlights: ['Microservicios con Java.'],
        relevant: true,
      },
    ],
    education: [
      { degree: 'Ingeniería en Sistemas', institution: 'UTN', startDate: '2013', endDate: '2019' },
    ],
    skills: [
      { name: 'Java', highlighted: true },
      { name: 'Git', highlighted: false },
    ],
    languages: [{ name: 'Inglés', level: 'B1' }],
  },
  suggestions: [
    {
      type: 'MISSING_REQUIRED_SKILL',
      skill: 'Kubernetes',
      message: 'La oferta pide Kubernetes. Si tenés experiencia, agregala.',
    },
    { type: 'LANGUAGE', message: 'La oferta pide inglés B2 y tu CV indica B1.' },
  ],
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockDraft(status = 200, body: unknown = { data: draft }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(respond(status, body))),
  );
}

function renderAdapt() {
  return render(
    <MemoryRouter initialEntries={['/cv/cv-1/adaptar/job-1']}>
      <App />
    </MemoryRouter>,
  );
}

const preview = () => screen.getByRole('article', { name: 'Vista previa del CV' });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdaptCvPage', () => {
  it('shows the draft, its suggestions and a Harvard preview', async () => {
    mockDraft();
    renderAdapt();
    expect(await screen.findByRole('heading', { name: 'Adaptá tu CV' })).toBeInTheDocument();
    expect(screen.getByText(/Backend Developer/, { selector: 'strong' })).toBeInTheDocument();
    expect(
      screen.getByText('La oferta pide Kubernetes. Si tenés experiencia, agregala.'),
    ).toBeInTheDocument();
    const paper = within(preview());
    expect(paper.getByRole('heading', { name: 'Tu nombre' })).toBeInTheDocument();
    expect(paper.getByText('mar 2021 – Actualidad')).toBeInTheDocument();
    expect(paper.getByText('Java · Git')).toBeInTheDocument();
    expect(paper.getByText('Inglés (B1)')).toBeInTheDocument();
  });

  it('offers the native level for languages', async () => {
    mockDraft();
    renderAdapt();
    await userEvent.selectOptions(await screen.findByLabelText('Nivel'), 'Nativo');
    expect(within(preview()).getByText('Inglés (Nativo)')).toBeInTheDocument();
  });

  it('updates the preview while editing and keeps the draft in the browser', async () => {
    mockDraft();
    renderAdapt();
    await userEvent.type(await screen.findByLabelText('Nombre y apellido'), 'María Fernández');
    expect(within(preview()).getByRole('heading', { name: 'María Fernández' })).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(storageKey('cv-1', 'job-1')) ?? '{}');
    expect(saved.personal.fullName).toBe('María Fernández');
  });

  it('adds a suggested technology only after confirmation', async () => {
    mockDraft();
    renderAdapt();
    await userEvent.click(await screen.findByRole('button', { name: 'La tengo, agregar' }));
    expect(screen.getByText('¿Realmente sabés Kubernetes?')).toBeInTheDocument();
    expect(within(preview()).queryByText(/Kubernetes/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sí, agregar' }));
    expect(within(preview()).getByText('Java · Git · Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('Agregada')).toBeInTheDocument();
  });

  it('removes technologies and restores the original draft on demand', async () => {
    mockDraft();
    renderAdapt();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar Git' }));
    expect(within(preview()).getByText('Java')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restablecer borrador' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, restablecer' }));
    expect(within(preview()).getByText('Java · Git')).toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey('cv-1', 'job-1'))).toBeNull();
  });

  it('resumes a draft saved in this browser', async () => {
    window.localStorage.setItem(
      storageKey('cv-1', 'job-1'),
      JSON.stringify({ ...draft.document, summary: 'Resumen que había editado.' }),
    );
    mockDraft();
    renderAdapt();
    expect(await screen.findByLabelText('Resumen profesional')).toHaveValue(
      'Resumen que había editado.',
    );
  });

  it('shows the first suggestions and the rest on demand', async () => {
    const many = ['Kubernetes', 'Angular', 'MongoDB', 'NestJS'].map((skill) => ({
      type: 'MISSING_REQUIRED_SKILL' as const,
      skill,
      message: `La oferta pide ${skill}. Si tenés experiencia, agregala.`,
    }));
    mockDraft(200, { data: { ...draft, suggestions: many } });
    renderAdapt();
    expect(await screen.findAllByRole('button', { name: 'La tengo, agregar' })).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: /Ver todas \(4\)/ }));
    expect(screen.getAllByRole('button', { name: 'La tengo, agregar' })).toHaveLength(4);
  });

  it('explains when the CV cannot be adapted yet', async () => {
    mockDraft(409, {
      error: {
        code: 'CV_NOT_PROCESSED',
        message: 'El CV todavía no terminó de procesarse o no se pudo procesar.',
        details: {},
      },
    });
    renderAdapt();
    expect(await screen.findByRole('alert')).toHaveTextContent('todavía no terminó de procesarse');
  });
});

describe('re-evaluating the adapted CV', () => {
  function mockApi() {
    const fetchFn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/evaluation') && init?.method === 'POST') {
        return Promise.resolve(
          respond(200, {
            data: {
              original: { level: 'MEDIUM' },
              adapted: {
                level: 'HIGH',
                reasons: [
                  {
                    criterion: 'skills',
                    status: 'positive',
                    message: 'Coinciden 3 de 3 tecnologías requeridas',
                  },
                ],
              },
            },
          }),
        );
      }
      return Promise.resolve(respond(200, { data: draft }));
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
  }

  it('compares before and after without sending personal data', async () => {
    const fetchFn = mockApi();
    renderAdapt();
    await userEvent.type(await screen.findByLabelText('Nombre y apellido'), 'María Fernández');
    await userEvent.type(screen.getByLabelText('Email'), 'maria@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Calcular compatibilidad' }));

    expect(
      await screen.findByText('Tu CV adaptado encaja mejor con esta oferta.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Compatibilidad media')).toBeInTheDocument();
    expect(screen.getByText('Alta compatibilidad')).toBeInTheDocument();
    expect(screen.getByText('Coinciden 3 de 3 tecnologías requeridas')).toBeInTheDocument();

    const post = fetchFn.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = String(post?.[1]?.body);
    expect(JSON.parse(body).personal).toEqual({
      headline: 'Desarrolladora Backend',
      location: 'Capital Federal, Buenos Aires',
    });
    expect(body).not.toContain('María');
    expect(body).not.toContain('maria@example.com');
  });

  it('marks the result as outdated after further edits', async () => {
    mockApi();
    renderAdapt();
    await userEvent.click(await screen.findByRole('button', { name: 'Calcular compatibilidad' }));
    await screen.findByText('Tu CV adaptado encaja mejor con esta oferta.');
    await userEvent.type(screen.getByLabelText('Resumen profesional'), ' Más texto.');
    expect(screen.getByText(/Hiciste cambios después de calcular/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a calcular' })).toBeInTheDocument();
  });
});

describe('PDF download', () => {
  it('asks for the name before printing', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    mockDraft();
    renderAdapt();
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar PDF' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Completá tu nombre');
    expect(print).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Nombre y apellido'), 'María');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prints the CV with a file name built from the name and the company', async () => {
    let titleWhilePrinting = '';
    const print = vi.fn(() => {
      titleWhilePrinting = window.document.title;
      window.dispatchEvent(new Event('afterprint'));
    });
    vi.stubGlobal('print', print);
    window.document.title = 'TechMatch';
    mockDraft();
    renderAdapt();
    await userEvent.type(await screen.findByLabelText('Nombre y apellido'), 'María Fernández');
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(titleWhilePrinting).toBe('CV - María Fernández - Empresa X');
    expect(window.document.title).toBe('TechMatch');
  });
});

describe('entry points', () => {
  it('offers "Adaptar mi CV" on each recommendation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          respond(200, {
            data: {
              cvId: 'cv-1',
              recommendations: [
                {
                  job: {
                    id: 'job-1',
                    title: 'Backend Developer',
                    company: 'Empresa X',
                    location: null,
                    modality: 'REMOTE',
                    source: 'getonboard',
                    sourceUrl: 'https://example.com/job',
                  },
                  match: { level: 'HIGH', reasons: [] },
                },
              ],
            },
          }),
        ),
      ),
    );
    render(
      <MemoryRouter initialEntries={['/cv/cv-1/recomendaciones']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Adaptar mi CV' })).toHaveAttribute(
      'href',
      '/cv/cv-1/adaptar/job-1',
    );
  });
});
