import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

/**
 * "Guardar en mi cuenta": saving a CV is the user's choice (unsaved ones expire after 30
 * days). Visitors see a lock that leads to the login and back, like every account privilege.
 */
export function SaveCvButton({
  cvId,
  saved,
  onSaved,
}: {
  cvId: string;
  saved: boolean;
  onSaved(): void;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <Link
        to="/ingresar"
        state={{ from: pathname }}
        className="button button--outlined"
        title="Requiere una cuenta"
      >
        <Icon name="lock" size={18} />
        Guardar en mi cuenta
      </Link>
    );
  }
  if (saved) {
    return (
      <Link to="/cuenta" className="button button--text saved-badge">
        <Icon name="check" size={18} />
        Guardado en tu cuenta
      </Link>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.saveCv(cvId);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos guardar el CV.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="save-cv">
      <button
        type="button"
        className="button button--outlined"
        disabled={busy}
        onClick={() => void save()}
      >
        <Icon name="briefcase" size={18} />
        {busy ? 'Guardando…' : 'Guardar en mi cuenta'}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
    </div>
  );
}
