import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { Icon } from './Icon';

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  busyLabel: string;
  /** "new-password" when creating an account, so password managers suggest one. */
  passwordAutoComplete: 'current-password' | 'new-password';
  passwordHint?: string;
  onSubmit(email: string, password: string): Promise<void>;
  footer: ReactNode;
  /** Extra content under an error, e.g. a resend button for EMAIL_NOT_VERIFIED. */
  errorAction?(code: string, email: string): ReactNode;
}

/** Email + password form shared by "Iniciar sesión" and "Crear cuenta". */
export function AuthForm(props: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit(email, password);
    } catch (err) {
      // The API messages are already in Spanish and meant for the user.
      setError(
        err instanceof ApiError
          ? { code: err.code, message: err.message }
          : { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      );
      setBusy(false);
    }
  }

  return (
    <form className="upload-card auth-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h1 className="auth-card__title">{props.title}</h1>
        <p className="body-muted">{props.subtitle}</p>
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
      <label className="field">
        <span className="field__label">Contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete={props.passwordAutoComplete}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {props.passwordHint && <span className="field__hint">{props.passwordHint}</span>}
      </label>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={18} />
          {error.message}
        </p>
      )}
      {error && props.errorAction?.(error.code, email)}
      <button type="submit" className="button button--filled button--block" disabled={busy}>
        {busy ? (
          <>
            <span className="spinner spinner--small" aria-hidden="true" />
            {props.busyLabel}
          </>
        ) : (
          props.submitLabel
        )}
      </button>
      <p className="auth-card__footer">{props.footer}</p>
    </form>
  );
}
