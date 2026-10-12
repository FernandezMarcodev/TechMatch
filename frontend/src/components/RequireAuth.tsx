import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Page } from './Layout';

/** Pages that need an account send visitors to "Iniciar sesión" and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Cargando…</p>
        </div>
      </Page>
    );
  }
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />;
  return children;
}
