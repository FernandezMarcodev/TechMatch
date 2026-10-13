import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, type SavedCv } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** One saved CV, with a two-step delete (no browser dialog). */
function SavedCvItem({ cv, onDeleted }: { cv: SavedCv; onDeleted(): void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    try {
      await api.deleteCv(cv.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err, 'No pudimos borrar el CV.'));
      setBusy(false);
    }
  }

  const count = cv.recommendationCount;
  return (
    <li className="saved-cv">
      <Icon name="file" size={22} className="saved-cv__icon" />
      <p className="saved-cv__name">{cv.originalFilename}</p>
      <p className="body-muted">
        Guardado el {dateFormat.format(new Date(cv.savedAt))} ·{' '}
        {count === 1 ? '1 recomendación' : `${count} recomendaciones`}
      </p>
      <div className="saved-cv__actions">
        {confirming ? (
          <>
            <button
              type="button"
              className="button button--danger-filled button--small"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Borrando…' : 'Sí, borrar'}
            </button>
            <button
              type="button"
              className="button button--text button--small"
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <Link
              to={`/cv/${encodeURIComponent(cv.id)}/recomendaciones`}
              className="button button--tonal button--small"
            >
              Ver recomendaciones
            </Link>
            <button
              type="button"
              className="button button--danger button--small"
              aria-label={`Borrar ${cv.originalFilename}`}
              onClick={() => setConfirming(true)}
            >
              Borrar
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="field-error saved-cv__actions" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
    </li>
  );
}

type CvsState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; cvs: SavedCv[] };

function SavedCvs() {
  const [state, setState] = useState<CvsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getMyCvs()
      .then(({ cvs }) => {
        if (!cancelled) setState({ kind: 'ready', cvs });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'error', message: errorMessage(err, 'No pudimos cargar tus CVs.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="account-section" aria-labelledby="saved-cvs-title">
      <h2 id="saved-cvs-title" className="account-section__title">
        Mis CVs guardados
      </h2>
      {state.kind === 'loading' && <p className="body-muted">Cargando…</p>}
      {state.kind === 'error' && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={18} />
          {state.message}
        </p>
      )}
      {state.kind === 'ready' && state.cvs.length === 0 && (
        <p className="body-muted">
          Todavía no guardaste ningún CV. Analizá uno y tocá &quot;Guardar en mi cuenta&quot; en sus
          recomendaciones. Los CVs que no guardás se borran solos a los 30 días.
        </p>
      )}
      {state.kind === 'ready' && state.cvs.length > 0 && (
        <ul className="saved-cvs">
          {state.cvs.map((cv) => (
            <SavedCvItem
              key={cv.id}
              cv={cv}
              onDeleted={() =>
                setState({ kind: 'ready', cvs: state.cvs.filter((c) => c.id !== cv.id) })
              }
            />
          ))}
        </ul>
      )}
      <Link to="/analizar" className="button button--tonal">
        <Icon name="upload" size={18} />
        Analizar un CV
      </Link>
    </section>
  );
}

/** Irreversible: asks for the password, then deletes the account and its saved CVs. */
function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      // The API already deleted the sessions; this forgets the local one.
      await logout();
      void navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'No pudimos borrar la cuenta.'));
      setBusy(false);
    }
  }

  return (
    <section className="account-section" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="account-section__title">
        Borrar mi cuenta
      </h2>
      <p className="body-muted">
        Se borran tu cuenta y tus CVs guardados, con sus recomendaciones. No se puede deshacer.
      </p>
      {open ? (
        <form className="account-section" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field__label">Tu contraseña, para confirmar</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={18} />
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="button button--danger-filled" disabled={busy}>
              {busy ? 'Borrando…' : 'Borrar definitivamente'}
            </button>
            <button type="button" className="button button--text" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="button button--danger" onClick={() => setOpen(true)}>
          Borrar mi cuenta
        </button>
      )}
    </section>
  );
}

/** "Mi cuenta": only for logged-in users (wrapped in RequireAuth). */
export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Page narrow>
      <div className="account-page">
        <section className="upload-card auth-card">
          <div>
            <h1 className="auth-card__title">Mi cuenta</h1>
          </div>
          <dl className="account-data">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Cuenta creada</dt>
            <dd>{dateFormat.format(new Date(user.createdAt))}</dd>
          </dl>
          <button
            type="button"
            className="button button--outlined button--block"
            onClick={() => {
              void logout().then(() => navigate('/'));
            }}
          >
            <Icon name="logout" size={18} />
            Cerrar sesión
          </button>
        </section>
        <section className="upload-card auth-card">
          <SavedCvs />
        </section>
        <section className="upload-card auth-card">
          <DeleteAccount />
        </section>
      </div>
    </Page>
  );
}
