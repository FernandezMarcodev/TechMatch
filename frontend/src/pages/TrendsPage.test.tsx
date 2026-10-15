import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const STATS = {
  generatedAt: '2026-10-14T12:00:00.000Z',
  totals: { offers: 311, companies: 104, remotePercent: 52, englishPercent: 41 },
  topSkills: [
    { name: 'REST', count: 149, percent: 48 },
    { name: 'React', count: 122, percent: 39 },
  ],
  seniority: [
    { level: 'JUNIOR', count: 11, avgExperienceYears: null },
    { level: 'SENIOR', count: 166, avgExperienceYears: 4.8 },
  ],
  modality: [
    { modality: 'REMOTE', count: 160 },
    { modality: null, count: 5 },
  ],
  sources: [
    { source: 'getonboard', count: 296 },
    { source: 'lever', count: 12 },
  ],
  topCompanies: [{ name: 'Despegar', count: 10 }],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('trends dashboard', () => {
  it('shows the totals and the bar charts, without an account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input) === '/api/stats/offers'
            ? json(200, { data: STATS })
            : json(200, { data: { status: 'ok' } }),
        ),
      ),
    );
    renderAt('/tendencias');

    expect(
      await screen.findByRole('heading', { name: 'Tendencias del mercado tech' }),
    ).toBeInTheDocument();
    expect(screen.getByText('311')).toBeInTheDocument();
    expect(screen.getByText('52 %')).toBeInTheDocument();

    const skills = screen.getByRole('region', { name: 'Tecnologías más pedidas' });
    expect(within(skills).getByText('REST')).toBeInTheDocument();
    expect(within(skills).getByText('48 %')).toBeInTheDocument();

    const seniority = screen.getByRole('region', { name: 'Seniority' });
    expect(within(seniority).getByText('Senior')).toBeInTheDocument();
    expect(within(seniority).getByText('166 · 4,8 años')).toBeInTheDocument();
    expect(within(seniority).getByText('11')).toBeInTheDocument();

    const modality = screen.getByRole('region', { name: 'Modalidad' });
    expect(within(modality).getByText('Sin especificar')).toBeInTheDocument();
    const sources = screen.getByRole('region', { name: 'Fuentes' });
    expect(within(sources).getByText('Empresas en Lever')).toBeInTheDocument();
  });

  it('is linked from the top bar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(200, { data: STATS }))),
    );
    renderAt('/analizar');
    await userEvent.click(screen.getByRole('link', { name: 'Tendencias del mercado' }));
    expect(
      await screen.findByRole('heading', { name: 'Tendencias del mercado tech' }),
    ).toBeInTheDocument();
  });

  it('explains when the trends cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Falló.' } })),
      ),
    );
    renderAt('/tendencias');
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló.');
  });
});
