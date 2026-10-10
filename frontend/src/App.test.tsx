import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(routes: Record<string, () => Response>) {
  const fn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const handler = routes[url];
    return Promise.resolve(
      handler ? handler() : jsonResponse(404, { error: { code: 'X', message: 'no' } }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const recommendation = {
  job: {
    id: 'job-1',
    title: 'Backend Developer',
    company: 'Empresa X',
    location: 'Buenos Aires',
    modality: 'HYBRID',
    source: 'getonboard',
    sourceUrl: 'https://example.com/job',
  },
  match: {
    level: 'HIGH',
    reasons: [
      {
        criterion: 'skills',
        status: 'positive',
        message: 'Coinciden 4 de 5 tecnologías requeridas',
      },
      {
        criterion: 'experience',
        status: 'negative',
        message: 'La oferta requiere 3 años y el CV indica 1 año',
      },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('upload', () => {
  it('rejects non-PDF files before uploading', async () => {
    const fetchFn = mockFetch({});
    renderAt('/');
    await userEvent.upload(
      screen.getByLabelText(/CV en PDF/),
      new File(['hola'], 'cv.txt', { type: 'text/plain' }),
      { applyAccept: false },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Analizar CV' }));
    expect(screen.getByRole('alert')).toHaveTextContent('formato PDF');
    // Only the wake-up call to the (possibly sleeping) backend; the file was never sent.
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual(['/api/health']);
  });

  it('uploads and moves to the processing screen, then to recommendations', async () => {
    let polls = 0;
    mockFetch({
      '/api/cvs': () => jsonResponse(201, { data: { cvId: 'cv-1', status: 'processing' } }),
      '/api/cvs/cv-1': () => {
        polls += 1;
        return jsonResponse(200, {
          data: { id: 'cv-1', status: polls > 1 ? 'processed' : 'processing' },
        });
      },
      '/api/recommendations/cv-1': () =>
        jsonResponse(200, { data: { cvId: 'cv-1', recommendations: [recommendation] } }),
    });
    renderAt('/');
    await userEvent.upload(
      screen.getByLabelText(/CV en PDF/),
      new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Analizar CV' }));
    expect(await screen.findByText('Analizando tu CV…')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Ofertas recomendadas' }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('shows the backend error message', async () => {
    mockFetch({
      '/api/cvs': () =>
        jsonResponse(400, {
          error: {
            code: 'INVALID_FILE',
            message: 'El archivo debe estar en formato PDF.',
            details: {},
          },
        }),
    });
    renderAt('/');
    await userEvent.upload(
      screen.getByLabelText(/CV en PDF/),
      new File(['x'], 'cv.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Analizar CV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo debe estar en formato PDF.',
    );
  });
});

describe('processing', () => {
  it('offers to upload another CV when processing fails', async () => {
    mockFetch({
      '/api/cvs/cv-1': () => jsonResponse(200, { data: { id: 'cv-1', status: 'failed' } }),
    });
    renderAt('/cv/cv-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos procesar tu CV');
    expect(screen.getByRole('link', { name: 'Cargar otro CV' })).toHaveAttribute('href', '/');
  });
});

describe('recommendations', () => {
  it('shows title, company, location, modality, level, reasons and source link — no numeric score', async () => {
    mockFetch({
      '/api/recommendations/cv-1': () =>
        jsonResponse(200, { data: { cvId: 'cv-1', recommendations: [recommendation] } }),
    });
    renderAt('/cv/cv-1/recomendaciones');
    expect(await screen.findByRole('link', { name: 'Backend Developer' })).toHaveAttribute(
      'href',
      '/ofertas/job-1?cv=cv-1',
    );
    expect(screen.getByText('Empresa X')).toBeInTheDocument();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('Híbrido')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alta compatibilidad' })).toBeInTheDocument();
    expect(screen.queryByText(/de 100/)).not.toBeInTheDocument();
    expect(screen.getByText('Alta compatibilidad')).toBeInTheDocument();
    expect(screen.getByText('Coinciden 4 de 5 tecnologías requeridas')).toBeInTheDocument();
    expect(screen.getByText('La oferta requiere 3 años y el CV indica 1 año')).toBeInTheDocument();
    const original = screen.getByRole('link', { name: 'Ver oferta original' });
    expect(original).toHaveAttribute('href', 'https://example.com/job');
    expect(original).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Cargar otro CV' })).toHaveAttribute('href', '/');
  });

  it('filters by level and remote modality without changing the order', async () => {
    const medium = {
      job: { ...recommendation.job, id: 'job-2', title: 'Frontend Developer', modality: 'REMOTE' },
      match: { ...recommendation.match, level: 'MEDIUM' },
    };
    mockFetch({
      '/api/recommendations/cv-1': () =>
        jsonResponse(200, { data: { cvId: 'cv-1', recommendations: [recommendation, medium] } }),
    });
    renderAt('/cv/cv-1/recomendaciones');
    expect(await screen.findByText('2 ofertas compatibles', { exact: false })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Media \(1\)/ }));
    expect(screen.queryByRole('link', { name: 'Backend Developer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frontend Developer' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Todas \(2\)/ }));
    await userEvent.click(screen.getByRole('button', { name: /Solo remoto \(1\)/ }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Frontend Developer',
    ]);
  });

  it('expands the full analysis on demand', async () => {
    const reasons = [
      {
        criterion: 'skills',
        status: 'positive',
        message: 'Coinciden 4 de 5 tecnologías requeridas',
      },
      {
        criterion: 'experience',
        status: 'negative',
        message: 'La oferta requiere 3 años y el CV indica 1 año',
      },
      { criterion: 'seniority', status: 'positive', message: 'Seniority compatible (Senior)' },
      {
        criterion: 'education',
        status: 'neutral',
        message: 'La oferta no especifica requisitos de educación',
      },
      { criterion: 'languages', status: 'positive', message: 'Inglés C1 cumple el nivel B2' },
    ];
    mockFetch({
      '/api/recommendations/cv-1': () =>
        jsonResponse(200, {
          data: {
            cvId: 'cv-1',
            recommendations: [{ ...recommendation, match: { ...recommendation.match, reasons } }],
          },
        }),
    });
    renderAt('/cv/cv-1/recomendaciones');
    const toggle = await screen.findByRole('button', { name: /Ver análisis completo/ });
    expect(screen.queryByText(/no especifica requisitos de educación/)).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText(/no especifica requisitos de educación/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver resumen/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows an empty state', async () => {
    mockFetch({
      '/api/recommendations/cv-1': () =>
        jsonResponse(200, { data: { cvId: 'cv-1', recommendations: [] } }),
    });
    renderAt('/cv/cv-1/recomendaciones');
    expect(await screen.findByText(/no encontramos ofertas/i)).toBeInTheDocument();
  });
});

describe('job detail', () => {
  it('shows the offer and a link to the original source', async () => {
    mockFetch({
      '/api/jobs/job-1': () =>
        jsonResponse(200, {
          data: {
            id: 'job-1',
            title: 'Backend Developer',
            company: 'Empresa X',
            location: 'Buenos Aires',
            modality: 'REMOTE',
            description: 'Línea 1\nLínea 2',
            requirements: ['Java', '2 años de experiencia'],
            skills: ['Java', 'SQL'],
            source: { name: 'getonboard', url: 'https://example.com/job' },
            isActive: true,
          },
        }),
    });
    renderAt('/ofertas/job-1?cv=cv-1');
    expect(await screen.findByRole('heading', { name: 'Backend Developer' })).toBeInTheDocument();
    expect(screen.getByText('Remoto')).toBeInTheDocument();
    expect(screen.getByText('2 años de experiencia')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver oferta original en Get on Board' }),
    ).toHaveAttribute('href', 'https://example.com/job');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Volver a las recomendaciones/ })).toHaveAttribute(
        'href',
        '/cv/cv-1/recomendaciones',
      ),
    );
  });
});
