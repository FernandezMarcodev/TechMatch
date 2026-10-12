import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { Page } from '../components/Layout';

/** Where to go after logging in: the page that asked for it, or the account page. */
function useReturnPath(): string {
  const state = useLocation().state as { from?: string } | null;
  return state?.from ?? '/cuenta';
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const returnPath = useReturnPath();
  if (user) return <Navigate to={returnPath} replace />;

  return (
    <Page narrow>
      <AuthForm
        title="Iniciar sesión"
        subtitle="Entrá a tu cuenta de TechMatch."
        submitLabel="Iniciar sesión"
        busyLabel="Ingresando…"
        passwordAutoComplete="current-password"
        onSubmit={async (email, password) => {
          await login(email, password);
          void navigate(returnPath, { replace: true });
        }}
        footer={
          <>
            ¿No tenés cuenta? <Link to="/crear-cuenta">Creá una</Link>
          </>
        }
      />
    </Page>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/cuenta" replace />;

  return (
    <Page narrow>
      <AuthForm
        title="Crear cuenta"
        subtitle="La cuenta es opcional: podés analizar tu CV sin registrarte."
        submitLabel="Crear cuenta"
        busyLabel="Creando cuenta…"
        passwordAutoComplete="new-password"
        passwordHint="Al menos 8 caracteres."
        onSubmit={async (email, password) => {
          await register(email, password);
          void navigate('/cuenta', { replace: true });
        }}
        footer={
          <>
            ¿Ya tenés cuenta? <Link to="/ingresar">Iniciá sesión</Link>
          </>
        }
      />
    </Page>
  );
}
