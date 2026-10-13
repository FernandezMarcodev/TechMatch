import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const TOKEN_KEY = 'techmatch.session';
const USER = {
  id: 'u1',
  email: 'ana@example.com',
  emailVerified: true,
  createdAt: '2026-05-01T12:00:00.000Z',
};
const SAVED = {
  id: 'cv-1',
  originalFilename: 'mi-cv.pdf',
  createdAt: '2026-05-02T12:00:00.000Z',
  savedAt: '2026-05-02T12:00:00.000Z',
  recommendationCount: 4,
};

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = (init?: RequestInit) => Response;

/** Fake API keyed by "METHOD /path"; logged in as USER. */
function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    if (key === 'GET /api/auth/me') return Promise.resolve(json(200, { data: { user: USER } }));
    const handler = routes[key];
    return Promise.resolve(
      handler ? handler(init) : json(404, { error: { code: 'X', message: 'no' } }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const calls = (fn: ReturnType<typeof mockApi>) =>
  fn.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${String(url)}`);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, 'tok-1');
});
afterEach(() => vi.unstubAllGlobals());

describe('saved CVs in "Mi cuenta"', () => {
  it('lists them with their recommendations and deletes one after confirming', async () => {
    const fetchFn = mockApi({
      'GET /api/me/cvs': () => json(200, { data: { cvs: [SAVED] } }),
      'DELETE /api/cvs/cv-1': () => json(204),
    });
    renderAt('/cuenta');

    const list = await screen.findByRole('list');
    expect(within(list).getByText('mi-cv.pdf')).toBeInTheDocument();
    expect(within(list).getByText(/4 recomendaciones/)).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Ver recomendaciones' })).toHaveAttribute(
      'href',
      '/cv/cv-1/recomendaciones',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Borrar mi-cv.pdf' }));
    expect(calls(fetchFn)).not.toContain('DELETE /api/cvs/cv-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    expect(await screen.findByText(/Todavía no guardaste ningún CV/)).toBeInTheDocument();
    expect(calls(fetchFn)).toContain('DELETE /api/cvs/cv-1');
  });

  it('explains how to save one when there are none', async () => {
    mockApi({ 'GET /api/me/cvs': () => json(200, { data: { cvs: [] } }) });
    renderAt('/cuenta');
    expect(await screen.findByText(/se borran solos a los 30 días/)).toBeInTheDocument();
  });
});

describe('deleting the account', () => {
  it('asks for the password, shows a wrong one and logs out after deleting', async () => {
    let attempts = 0;
    const fetchFn = mockApi({
      'GET /api/me/cvs': () => json(200, { data: { cvs: [] } }),
      'DELETE /api/auth/account': () => {
        attempts += 1;
        return attempts === 1
          ? json(401, {
              error: { code: 'INVALID_CREDENTIALS', message: 'La contraseña no es correcta.' },
            })
          : json(204);
      },
      'POST /api/auth/logout': () => json(401, { error: { code: 'UNAUTHENTICATED', message: '' } }),
      'GET /api/health': () => json(200, { data: { status: 'ok' } }),
    });
    renderAt('/cuenta');

    await userEvent.click(await screen.findByRole('button', { name: 'Borrar mi cuenta' }));
    await userEvent.type(screen.getByLabelText('Tu contraseña, para confirmar'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Borrar definitivamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña no es correcta.');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-1');

    await userEvent.click(screen.getByRole('button', { name: 'Borrar definitivamente' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    const request = fetchFn.mock.calls.find(([url]) => String(url) === '/api/auth/account');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ password: 'otra' });
  });
});

describe('"Guardar en mi cuenta" on the recommendations', () => {
  const recommendations = (saved: boolean) => () =>
    json(200, { data: { cvId: 'cv-1', hiddenCount: 0, saved, recommendations: [] } });

  it('saves the CV when the user chooses to', async () => {
    const fetchFn = mockApi({
      'GET /api/recommendations/cv-1': recommendations(false),
      'POST /api/cvs/cv-1/save': () => json(200, { data: { id: 'cv-1', saved: true } }),
    });
    renderAt('/cv/cv-1/recomendaciones');

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar en mi cuenta' }));
    expect(await screen.findByRole('link', { name: 'Guardado en tu cuenta' })).toHaveAttribute(
      'href',
      '/cuenta',
    );
    expect(calls(fetchFn)).toContain('POST /api/cvs/cv-1/save');
  });

  it('shows that an already saved CV is in the account', async () => {
    mockApi({ 'GET /api/recommendations/cv-1': recommendations(true) });
    renderAt('/cv/cv-1/recomendaciones');
    expect(await screen.findByRole('link', { name: 'Guardado en tu cuenta' })).toBeInTheDocument();
  });

  it('shows visitors a lock that leads to the login', async () => {
    localStorage.clear();
    mockApi({ 'GET /api/recommendations/cv-1': recommendations(false) });
    renderAt('/cv/cv-1/recomendaciones');
    const link = await screen.findByRole('link', { name: 'Guardar en mi cuenta' });
    expect(link).toHaveAttribute('href', '/ingresar');
    expect(link).toHaveAttribute('title', 'Requiere una cuenta');
  });
});
