import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, api, type JobDetail } from '../api/client';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';
import { MODALITY_ICONS, modalityLabel, sourceLabel } from '../components/labels';

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; job: JobDetail };

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const [params] = useSearchParams();
  const cvId = params.get('cv');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getJob(jobId)
      .then((job) => {
        if (!cancelled) setState({ kind: 'ready', job });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'No se pudo cargar la oferta.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const back = cvId ? (
    <Link to={`/cv/${encodeURIComponent(cvId)}/recomendaciones`} className="button button--text">
      <Icon name="back" size={18} />
      Volver a las recomendaciones
    </Link>
  ) : (
    <Link to="/" className="button button--text">
      <Icon name="back" size={18} />
      Ir al inicio
    </Link>
  );

  if (state.kind === 'loading') {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Cargando oferta…</p>
        </div>
      </Page>
    );
  }

  if (state.kind === 'error') {
    return (
      <Page narrow>
        <StateView icon="alert" tone="error" title="No pudimos mostrar la oferta" actions={back}>
          <p role="alert">{state.message}</p>
        </StateView>
      </Page>
    );
  }

  const { job } = state;
  const source = sourceLabel(job.source.name);
  return (
    <Page>
      <nav className="detail-nav">
        {back}
        <Link to="/" className="button button--tonal button--small">
          <Icon name="upload" size={16} />
          Cargar otro CV
        </Link>
      </nav>

      <article className="detail">
        <header className="detail__header card card--filled">
          <h1 className="headline-large">{job.title}</h1>
          <ul className="meta meta--large">
            <li>
              <Icon name="briefcase" size={18} />
              {job.company}
            </li>
            {job.location && (
              <li>
                <Icon name="pin" size={18} />
                {job.location}
              </li>
            )}
            {job.modality && (
              <li>
                <Icon name={MODALITY_ICONS[job.modality]} size={18} />
                {modalityLabel(job.modality)}
              </li>
            )}
          </ul>
          {!job.isActive && (
            <p className="banner banner--warning">
              <Icon name="alert" size={18} />
              Esta oferta ya no aparece publicada en {source}.
            </p>
          )}
        </header>

        <div className="detail__layout">
          <div className="detail__main">
            {job.requirements.length > 0 && (
              <section className="card card--outlined detail__section">
                <h2 className="title-large">Requisitos</h2>
                <ul className="bullets">
                  {job.requirements.map((req, i) => (
                    <li key={`${i}-${req}`}>{req}</li>
                  ))}
                </ul>
              </section>
            )}
            {job.description && (
              <section className="card card--outlined detail__section">
                <h2 className="title-large">Descripción</h2>
                <div className="prose">
                  {job.description.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="detail__aside">
            <section className="card card--outlined detail__section">
              <a
                href={job.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button button--filled button--block"
              >
                Ver oferta original en {source}
                <Icon name="external" size={16} />
              </a>
              {cvId && (
                <Link
                  to={`/cv/${encodeURIComponent(cvId)}/adaptar/${job.id}`}
                  className="button button--tonal button--block detail__adapt"
                >
                  <Icon name="file" size={16} />
                  Adaptar mi CV a esta oferta
                </Link>
              )}
              <p className="body-muted detail__note">
                La postulación se hace en {source}. TechMatch no envía tu CV a ninguna empresa.
              </p>
            </section>
            {job.skills.length > 0 && (
              <section className="card card--outlined detail__section">
                <h2 className="title-medium">Tecnologías</h2>
                <ul className="chips">
                  {job.skills.map((skill) => (
                    <li key={skill} className="assist-chip">
                      {skill}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </article>
    </Page>
  );
}
