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
          <p>Verificando tu sesión…</p>
        </div>
        <p className="body-muted">
          Si el servidor estaba inactivo, puede tardar hasta un minuto en responder.
        </p>
      </Page>
    );
  }
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />;
  return children;
}
