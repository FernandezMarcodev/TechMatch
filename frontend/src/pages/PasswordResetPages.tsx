import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.';
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      <Icon name="alert" size={18} />
      {message}
    </p>
  );
}

/** "¿Olvidaste tu contraseña?": asks for the email and sends the reset link. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    // Same text whether the account exists or not: the API does not reveal it either.
    return (
      <Page narrow>
        <StateView
          icon="check"
          title="Revisá tu email"
          actions={
            <Link to="/ingresar" className="button button--outlined">
              Volver a iniciar sesión
            </Link>
          }
        >
          <p>
            Si existe una cuenta con <strong>{email.trim()}</strong>, te mandamos un link para
            elegir una nueva contraseña. Vence en 30 minutos; si no lo ves, revisá el spam.
          </p>
        </StateView>
      </Page>
    );
  }

  return (
    <Page narrow>
      <form className="upload-card auth-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="auth-card__title">¿Olvidaste tu contraseña?</h1>
          <p className="body-muted">
            Ingresá el email de tu cuenta y te mandamos un link para elegir una nueva.
          </p>
        </div>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <FormError message={error} />
        <button type="submit" className="button button--filled button--block" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar link'}
        </button>
        <p className="auth-card__footer">
          <Link to="/ingresar">Volver a iniciar sesión</Link>
        </p>
      </form>
    </Page>
  );
}

/** Target of the link in the reset email: /restablecer?token=… */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== repeat) {
      setError({ code: 'MISMATCH', message: 'Las contraseñas no coinciden.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token ?? '', password);
      // The API closed every session, including this browser's one if there was any.
      await logout();
      setDone(true);
    } catch (err) {
      setError({
        code: err instanceof ApiError ? err.code : 'INTERNAL_ERROR',
        message: errorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  }

  const toLogin = (
    <Link to="/ingresar" className="button button--filled">
      <Icon name="user" size={18} />
      Iniciar sesión
    </Link>
  );
  if (!token) {
    return (
      <Page narrow>
        <StateView icon="alert" tone="error" title="El link está incompleto" actions={toLogin}>
          <p>Abrí el link completo del email, o pedí uno nuevo desde "Iniciar sesión".</p>
        </StateView>
      </Page>
    );
  }
  if (done) {
    return (
      <Page narrow>
        <StateView icon="check" title="Contraseña actualizada" actions={toLogin}>
          <p>Ya podés iniciar sesión con tu nueva contraseña. Cerramos las sesiones abiertas.</p>
        </StateView>
      </Page>
    );
  }

  return (
    <Page narrow>
      <form className="upload-card auth-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h1 className="auth-card__title">Elegí una nueva contraseña</h1>
          <p className="body-muted">Al guardarla se cierran todas las sesiones abiertas.</p>
        </div>
        <label className="field">
          <span className="field__label">Nueva contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field__hint">Al menos 8 caracteres.</span>
        </label>
        <label className="field">
          <span className="field__label">Repetir contraseña</span>
          <input
            type="password"
            name="repeat"
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        <FormError message={error?.message ?? null} />
        {error?.code === 'INVALID_TOKEN' && (
          <Link to="/olvide-contrasena" className="button button--outlined button--block">
            Pedir un link nuevo
          </Link>
        )}
        <button type="submit" className="button button--filled button--block" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </Page>
  );
}
