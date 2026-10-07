import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';

export const POLL_INTERVAL_MS = 1500;

export function ProcessingPage() {
  const { cvId = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const { status } = await api.getCvStatus(cvId);
        if (cancelled) return;
        if (status === 'processed') {
          navigate(`/cv/${cvId}/recomendaciones`, { replace: true });
        } else if (status === 'failed') {
          setError(
            'No pudimos procesar tu CV. Verificá que sea un PDF con texto seleccionable (no una imagen escaneada).',
          );
        } else {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Ocurrió un error.');
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cvId, navigate]);

  if (error) {
    return (
      <Page narrow>
        <StateView
          icon="alert"
          tone="error"
          title="No se pudo procesar el CV"
          actions={
            <Link to="/" className="button button--filled">
              <Icon name="upload" size={18} />
              Cargar otro CV
            </Link>
          }
        >
          <p role="alert">{error}</p>
        </StateView>
      </Page>
    );
  }

  return (
    <Page narrow>
      <section className="processing card card--elevated" aria-busy="true">
        <div className="progress-linear" aria-hidden="true" />
        <span className="spinner" aria-hidden="true" />
        <h1 className="headline">Analizando tu CV…</h1>
        <p className="body-muted">Suele tardar unos segundos.</p>
        <ol className="processing__steps">
          <li className="processing__step processing__step--done">
            <Icon name="check" size={18} />
            CV recibido
          </li>
          <li className="processing__step processing__step--active">
            <span className="spinner spinner--small" aria-hidden="true" />
            Extrayendo tu experiencia, tecnologías e idiomas
          </li>
          <li className="processing__step processing__step--active">
            <span className="spinner spinner--small" aria-hidden="true" />
            Comparando con las ofertas activas
          </li>
        </ol>
      </section>
    </Page>
  );
}
