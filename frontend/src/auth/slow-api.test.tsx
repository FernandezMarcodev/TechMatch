import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('front page while the API is waking up', () => {
  it('never renders blank with a stored session, and wakes the API up', async () => {
    localStorage.setItem('techmatch.session', 'tok-1');
    // The free API sleeps: /api/auth/me does not answer for a long time.
    const fetchFn = vi.fn((_input: RequestInfo | URL) => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchFn);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Verificando tu sesión/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuar sin cuenta' })).toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toContain('/api/health');
  });
});
