import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const TOKEN_KEY = 'techmatch.session';

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockApi(routes: Record<string, () => Response>) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const handler = routes[`${init?.method ?? 'GET'} ${String(input)}`];
    return Promise.resolve(handler ? handler() : json(200, { data: {} }));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const bodyOf = (fn: ReturnType<typeof mockApi>, url: string) =>
  JSON.parse(String(fn.mock.calls.find(([u]) => String(u) === url)?.[1]?.body)) as unknown;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('password reset', () => {
  it('is reachable from the login page', async () => {
    mockApi({});
    renderAt('/ingresar');
    await userEvent.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }));
    expect(
      await screen.findByRole('heading', { name: '¿Olvidaste tu contraseña?' }),
    ).toBeInTheDocument();
  });

  it('asks for the email and answers without revealing whether the account exists', async () => {
    const fetchFn = mockApi({ 'POST /api/auth/password-reset': () => json(202) });
    renderAt('/olvide-contrasena');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByRole('heading', { name: 'Revisá tu email' })).toBeInTheDocument();
    expect(screen.getByText(/Si existe una cuenta con/)).toBeInTheDocument();
    expect(bodyOf(fetchFn, '/api/auth/password-reset')).toEqual({ email: 'ana@example.com' });
  });

  it('sets the new password with the token of the link and forgets the local session', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-viejo');
    const fetchFn = mockApi({
      'GET /api/auth/me': () =>
        json(401, { error: { code: 'UNAUTHENTICATED', message: 'Sesión cerrada.' } }),
      'POST /api/auth/password-reset/confirm': () => json(204),
      'POST /api/auth/logout': () => json(401, { error: { code: 'UNAUTHENTICATED', message: '' } }),
    });
    renderAt('/restablecer?token=tok-del-link');

    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'nueva-clave-456');
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'nueva-clave-456');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(
      await screen.findByRole('heading', { name: 'Contraseña actualizada' }),
    ).toBeInTheDocument();
    expect(bodyOf(fetchFn, '/api/auth/password-reset/confirm')).toEqual({
      token: 'tok-del-link',
      password: 'nueva-clave-456',
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('checks that both passwords match before calling the API', async () => {
    const fetchFn = mockApi({});
    renderAt('/restablecer?token=tok');
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'nueva-clave-456');
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'otra-clave-456');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.');
    expect(fetchFn.mock.calls.map(([u]) => String(u))).not.toContain(
      '/api/auth/password-reset/confirm',
    );
  });

  it('offers a new link when the token is invalid or expired', async () => {
    mockApi({
      'POST /api/auth/password-reset/confirm': () =>
        json(400, {
          error: { code: 'INVALID_TOKEN', message: 'El link no es válido o ya venció.' },
        }),
    });
    renderAt('/restablecer?token=viejo');
    await userEvent.type(screen.getByLabelText(/^Nueva contraseña/), 'nueva-clave-456');
    await userEvent.type(screen.getByLabelText('Repetir contraseña'), 'nueva-clave-456');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El link no es válido o ya venció.');
    expect(screen.getByRole('link', { name: 'Pedir un link nuevo' })).toBeInTheDocument();
  });
});
