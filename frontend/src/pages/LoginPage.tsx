import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { ResendVerification } from '../components/ResendVerification';

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
        errorAction={(code, email) =>
          code === 'EMAIL_NOT_VERIFIED' ? <ResendVerification key={email} email={email} /> : null
        }
        footer={
          <>
            <Link to="/olvide-contrasena">¿Olvidaste tu contraseña?</Link>
            <br />
            ¿No tenés cuenta? <Link to="/crear-cuenta">Creá una</Link>
          </>
        }
      />
    </Page>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  if (user) return <Navigate to="/cuenta" replace />;

  if (registeredEmail) {
    return (
      <Page narrow>
        <section className="upload-card auth-card">
          <span className="state-view__icon">
            <Icon name="check" size={32} />
          </span>
          <div>
            <h1 className="auth-card__title">Revisá tu email</h1>
            <p className="body-muted">
              Te mandamos un link a <strong>{registeredEmail}</strong> para confirmar tu cuenta.
              Abrilo para poder iniciar sesión. Vence en 24 horas; si no lo ves, revisá el spam.
            </p>
          </div>
          <ResendVerification email={registeredEmail} />
          <p className="auth-card__footer">
            ¿Ya lo confirmaste? <Link to="/ingresar">Iniciá sesión</Link>
          </p>
        </section>
      </Page>
    );
  }

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
          setRegisteredEmail(email.trim().toLowerCase());
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
