import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';

type State = { kind: 'verifying' } | { kind: 'done' } | { kind: 'error'; message: string };

/** Target of the link in the verification email: /verificar-email?token=… */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(() =>
    token ? { kind: 'verifying' } : { kind: 'error', message: 'El link está incompleto.' },
  );
  // A link works only once: in development React runs effects twice, so call the API once.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api
      .verifyEmail(token)
      .then(() => setState({ kind: 'done' }))
      .catch((err: unknown) =>
        setState({
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'No pudimos confirmar tu email.',
        }),
      );
  }, [token]);

  if (state.kind === 'verifying') {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Confirmando tu email…</p>
        </div>
      </Page>
    );
  }

  const toLogin = (
    <Link to="/ingresar" className="button button--filled">
      <Icon name="user" size={18} />
      Iniciar sesión
    </Link>
  );
  if (state.kind === 'done') {
    return (
      <Page narrow>
        <StateView icon="check" title="¡Email confirmado!" actions={toLogin}>
          <p>Tu cuenta está lista. Ya podés iniciar sesión.</p>
        </StateView>
      </Page>
    );
  }
  return (
    <Page narrow>
      <StateView icon="alert" tone="error" title="No pudimos confirmar tu email" actions={toLogin}>
        <p role="alert">{state.message}</p>
        <p>
          Si tu cuenta todavía no está confirmada, al iniciar sesión vas a poder pedir otro link.
        </p>
      </StateView>
    </Page>
  );
}
