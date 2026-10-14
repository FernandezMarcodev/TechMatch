import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthForm } from '../components/AuthForm';
import { AuthLayout, GuestAccess } from '../components/AuthLayout';
import { Icon } from '../components/Icon';
import { ResendVerification } from '../components/ResendVerification';

/** The page that sent the visitor here (a page that needs an account), if any. */
function useFrom(): string | undefined {
  return (useLocation().state as { from?: string } | null)?.from;
}

/**
 * Login. Also the site's front page ("/"): visitors see it first, with "Continuar sin cuenta"
 * one click away; logged-in users go straight to the CV upload.
 */
export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const from = useFrom();
  // After logging in: back to the page that asked for it, or the CV upload.
  const returnPath = from ?? '/analizar';
  // This is the front page: start waking the free API up (it sleeps when idle) right away.
  useEffect(() => api.wakeUp(), []);
  if (user) return <Navigate to={returnPath} replace />;
  // A stored session is being checked; the sleeping API can take up to a minute to answer.
  // Never a blank page: say what is happening and keep the anonymous flow at hand.
  if (loading) {
    return (
      <AuthLayout>
        <section className="upload-card auth-card" aria-busy="true">
          <div className="loading-row">
            <span className="spinner spinner--small" aria-hidden="true" />
            <p>Verificando tu sesión…</p>
          </div>
          <p className="body-muted">
            Si el servidor estaba inactivo, puede tardar hasta un minuto en responder.
          </p>
        </section>
        <GuestAccess />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {from && (
        <p className="auth-notice" role="status">
          <Icon name="lock" size={18} />
          Esta función es para usuarios con cuenta. Iniciá sesión o creá una gratis; después volvés
          a donde estabas.
        </p>
      )}
      <AuthForm
        title="Iniciar sesión"
        subtitle="Entrá a tu cuenta para ver todas tus recomendaciones y adaptar tu CV."
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
      <GuestAccess />
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  if (user) return <Navigate to="/analizar" replace />;

  if (registeredEmail) {
    return (
      <AuthLayout>
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
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthForm
        title="Crear cuenta"
        subtitle="Es gratis. Solo necesitás un email y una contraseña."
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
      <GuestAccess />
    </AuthLayout>
  );
}
