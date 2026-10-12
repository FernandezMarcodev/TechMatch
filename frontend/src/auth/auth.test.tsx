import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const USER = {
  id: 'u1',
  email: 'ana@example.com',
  emailVerified: false,
  createdAt: '2026-05-01T12:00:00.000Z',
};
const TOKEN_KEY = 'techmatch.session';

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = (init?: RequestInit) => Response;

/** Fake API keyed by "METHOD /path". */
function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    return Promise.resolve(
      handler ? handler(init) : json(404, { error: { code: 'X', message: 'no' } }),
    );
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const authHeader = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('accounts in the frontend', () => {
  it('creates an account and asks to confirm the email, without logging in', async () => {
    const fetchFn = mockApi({
      'GET /api/health': () => json(200, { data: { status: 'ok' } }),
      'POST /api/auth/register': () => json(201, { data: { user: USER } }),
      'POST /api/auth/verify-email/resend': () => json(202),
    });
    renderAt('/crear-cuenta');

    await userEvent.type(screen.getByLabelText('Email'), 'Ana@Example.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'clave-segura-123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Revisá tu email' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    const urls = fetchFn.mock.calls.map(([url]) => String(url));
    expect(urls).not.toContain('/api/auth/login');

    await userEvent.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Te mandamos un nuevo email');
    const resend = fetchFn.mock.calls.find(([url]) => String(url).endsWith('/resend'));
    expect(JSON.parse(String(resend?.[1]?.body))).toEqual({ email: 'ana@example.com' });
  });

  it('offers to resend the link when an unverified account tries to log in', async () => {
    const fetchFn = mockApi({
      'POST /api/auth/login': () =>
        json(403, {
          error: { code: 'EMAIL_NOT_VERIFIED', message: 'Todavía no confirmaste tu email.' },
        }),
      'POST /api/auth/verify-email/resend': () => json(202),
    });
    renderAt('/ingresar');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Todavía no confirmaste tu email.');
    await userEvent.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toContain(
      '/api/auth/verify-email/resend',
    );
  });

  it('confirms the email from the link, calling the API only once', async () => {
    const fetchFn = mockApi({
      'POST /api/auth/verify-email': () =>
        json(200, { data: { user: { ...USER, emailVerified: true } } }),
    });
    renderAt('/verificar-email?token=tok-del-link');

    expect(await screen.findByRole('heading', { name: '¡Email confirmado!' })).toBeInTheDocument();
    const calls = fetchFn.mock.calls.filter(([url]) => String(url) === '/api/auth/verify-email');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ token: 'tok-del-link' });
    // One in the top bar and the page's call to action.
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })).toHaveLength(2);
  });

  it('explains when the link is invalid or expired', async () => {
    mockApi({
      'POST /api/auth/verify-email': () =>
        json(400, {
          error: { code: 'INVALID_TOKEN', message: 'El link no es válido o ya venció.' },
        }),
    });
    renderAt('/verificar-email?token=viejo');
    expect(await screen.findByRole('alert')).toHaveTextContent('El link no es válido o ya venció.');
  });

  it('shows the API error when the credentials are wrong', async () => {
    mockApi({
      'POST /api/auth/login': () =>
        json(401, {
          error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos.' },
        }),
    });
    renderAt('/ingresar');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'otra-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('sends visitors of a protected page to login and back afterwards', async () => {
    mockApi({
      'POST /api/auth/login': () =>
        json(200, { data: { token: 'tok-1', expiresAt: '2026-06-01T00:00:00Z', user: USER } }),
    });
    renderAt('/cuenta');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura-123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
  });

  it('restores a stored session sending the token in the Authorization header', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-guardado');
    let sentHeader: string | null = null;
    mockApi({
      'GET /api/auth/me': (init) => {
        sentHeader = authHeader(init);
        return json(200, { data: { user: USER } });
      },
    });
    renderAt('/cuenta');

    expect(await screen.findByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(sentHeader).toBe('Bearer tok-guardado');
    expect(screen.getByRole('link', { name: 'Mi cuenta (ana@example.com)' })).toBeInTheDocument();
  });

  it('forgets a stored session the API no longer accepts', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-vencido');
    mockApi({
      'GET /api/auth/me': () =>
        json(401, { error: { code: 'UNAUTHENTICATED', message: 'Tenés que iniciar sesión.' } }),
    });
    renderAt('/cuenta');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('logs out: closes the session in the API and forgets the token', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-1');
    const fetchFn = mockApi({
      'GET /api/health': () => json(200, { data: { status: 'ok' } }),
      'GET /api/auth/me': () => json(200, { data: { user: USER } }),
      'POST /api/auth/logout': () => json(204),
    });
    renderAt('/cuenta');

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull());
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    const logout = fetchFn.mock.calls.find(([url]) => String(url) === '/api/auth/logout');
    expect(authHeader(logout?.[1])).toBe('Bearer tok-1');
  });

  it('shows "Iniciar sesión" to visitors without calling the API', async () => {
    const fetchFn = mockApi({ 'GET /api/health': () => json(200, { data: { status: 'ok' } }) });
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url]) => String(url))).not.toContain('/api/auth/me');
  });
});
