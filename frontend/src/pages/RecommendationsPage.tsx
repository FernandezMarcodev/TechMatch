import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, api, type MatchLevel, type Recommendation } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AdaptCvLink } from '../components/AdaptCvLink';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { SaveCvButton } from '../components/SaveCvButton';
import { LevelChip, LevelMeter } from '../components/MatchBadge';
import { MissingSkills } from '../components/MissingSkills';
import { ReasonList } from '../components/ReasonList';
import { StateView } from '../components/StateView';
import { MODALITY_ICONS, modalityLabel, sourceLabel } from '../components/labels';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: Recommendation[]; hiddenCount: number; saved: boolean };

type LevelFilter = 'ALL' | MatchLevel;

const PAGE_SIZE = 15;

function RecommendationCard({ item, cvId }: { item: Recommendation; cvId: string }) {
  const { job, match } = item;
  const detailUrl = `/ofertas/${job.id}?cv=${encodeURIComponent(cvId)}`;
  return (
    <li className="card card--outlined recommendation">
      <div className="recommendation__header">
        <LevelMeter level={match.level} />
        <div className="recommendation__heading">
          <LevelChip level={match.level} />
          <h2 className="recommendation__title">
            <Link to={detailUrl}>{job.title}</Link>
          </h2>
          <ul className="meta">
            <li>
              <Icon name="briefcase" size={16} />
              {job.company}
            </li>
            {job.location && (
              <li>
                <Icon name="pin" size={16} />
                {job.location}
              </li>
            )}
            {job.modality && (
              <li>
                <Icon name={MODALITY_ICONS[job.modality]} size={16} />
                {modalityLabel(job.modality)}
              </li>
            )}
          </ul>
        </div>
      </div>
      <ReasonList reasons={match.reasons} />
      <div className="recommendation__actions">
        <Link to={detailUrl} className="button button--outlined">
          Ver detalle
        </Link>
        <AdaptCvLink
          cvId={cvId}
          jobId={job.id}
          label="Adaptar mi CV"
          className="button button--tonal"
        />
        <a
          href={job.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button button--filled"
        >
          Ver oferta original
          <Icon name="external" size={16} />
        </a>
      </div>
      <p className="recommendation__source">Publicada en {sourceLabel(job.source)}</p>
    </li>
  );
}

/** "5 ofertas compatibles, ordenadas…" plus, for visitors, how many of them they see. */
export function summary(total: number, visibleCount: number): string {
  const found =
    total === 1
      ? '1 oferta compatible.'
      : `${total} ofertas compatibles, ordenadas de mayor a menor compatibilidad.`;
  if (visibleCount >= total || visibleCount === 0) return found;
  return visibleCount === 1
    ? `${found} Sin cuenta ves la primera.`
    : `${found} Sin cuenta ves las primeras ${visibleCount}.`;
}

/** The recommendations a visitor cannot see: an invitation to create an account. */
function LockedRecommendations({ count, more }: { count: number; more: boolean }) {
  const { pathname } = useLocation();
  const offers = count === 1 ? '1 oferta' : `${count} ofertas`;
  return (
    <section className="locked-recommendations" aria-labelledby="locked-title">
      <span className="locked-recommendations__icon">
        <Icon name="lock" size={24} />
      </span>
      <div>
        <h2 id="locked-title" className="title-medium">
          {more ? `Hay ${offers} más para vos` : `Hay ${offers} para vos`}
        </h2>
        <p className="body-muted">
          Creá una cuenta gratis o iniciá sesión para ver todas tus recomendaciones y adaptar tu CV
          a cada oferta.
        </p>
      </div>
      <div className="locked-recommendations__actions">
        <Link to="/crear-cuenta" className="button button--filled">
          Crear cuenta
        </Link>
        <Link to="/ingresar" state={{ from: pathname }} className="button button--outlined">
          Iniciar sesión
        </Link>
      </div>
    </section>
  );
}

export function RecommendationsPage() {
  const { cvId = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [level, setLevel] = useState<LevelFilter>('ALL');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Fetched again when the session changes: logging in reveals the hidden recommendations.
  const userId = user?.id;
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    api
      .getRecommendations(cvId)
      .then((data) => {
        if (!cancelled) {
          setState({
            kind: 'ready',
            items: data.recommendations,
            hiddenCount: data.hiddenCount,
            saved: data.saved,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              err instanceof ApiError ? err.message : 'No se pudieron cargar las recomendaciones.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cvId, userId, authLoading]);

  const items = state.kind === 'ready' ? state.items : [];
  const hiddenCount = state.kind === 'ready' ? state.hiddenCount : 0;
  const total = items.length + hiddenCount;
  const counts = {
    ALL: items.length,
    HIGH: items.filter((i) => i.match.level === 'HIGH').length,
    MEDIUM: items.filter((i) => i.match.level === 'MEDIUM').length,
    REMOTE: items.filter((i) => i.job.modality === 'REMOTE').length,
  };
  // Filters only narrow the list; the order (best match first) comes from the API.
  const filtered = items.filter(
    (i) =>
      (level === 'ALL' || i.match.level === level) && (!remoteOnly || i.job.modality === 'REMOTE'),
  );

  const uploadAnother = (
    <Link to="/analizar" className="button button--tonal">
      <Icon name="upload" size={18} />
      Cargar otro CV
    </Link>
  );

  if (state.kind === 'loading') {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Cargando recomendaciones…</p>
        </div>
      </Page>
    );
  }

  if (state.kind === 'error') {
    return (
      <Page narrow>
        <StateView
          icon="alert"
          tone="error"
          title="No pudimos cargar tus recomendaciones"
          actions={uploadAnother}
        >
          <p role="alert">{state.message}</p>
        </StateView>
      </Page>
    );
  }

  return (
    <Page>
      <header className="page-header">
        <div>
          <h1 className="headline-large">Ofertas recomendadas</h1>
          {total > 0 && <p className="body-muted">{summary(total, items.length)}</p>}
        </div>
        <div className="page-header__actions">
          <SaveCvButton
            cvId={cvId}
            saved={state.saved}
            onSaved={() => setState({ ...state, saved: true })}
          />
          {uploadAnother}
        </div>
      </header>

      <MissingSkills cvId={cvId} />

      {total === 0 ? (
        <StateView icon="search" title="Todavía no hay ofertas compatibles">
          <p>
            No encontramos ofertas con compatibilidad media o alta para tu CV. Las ofertas se
            actualizan periódicamente: podés volver a intentarlo más adelante.
          </p>
        </StateView>
      ) : items.length === 0 ? (
        <LockedRecommendations count={hiddenCount} more={false} />
      ) : (
        <>
          <div className="chip-set" role="group" aria-label="Filtrar recomendaciones">
            {(
              [
                ['ALL', `Todas (${counts.ALL})`],
                ['HIGH', `Alta (${counts.HIGH})`],
                ['MEDIUM', `Media (${counts.MEDIUM})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="filter-chip"
                aria-pressed={level === value}
                onClick={() => {
                  setLevel(value);
                  setVisible(PAGE_SIZE);
                }}
              >
                {level === value && <Icon name="check" size={16} />}
                {label}
              </button>
            ))}
            <span className="chip-set__divider" aria-hidden="true" />
            <button
              type="button"
              className="filter-chip"
              aria-pressed={remoteOnly}
              onClick={() => {
                setRemoteOnly((v) => !v);
                setVisible(PAGE_SIZE);
              }}
            >
              {remoteOnly ? <Icon name="check" size={16} /> : <Icon name="globe" size={16} />}
              Solo remoto ({counts.REMOTE})
            </button>
          </div>

          {filtered.length === 0 ? (
            <StateView icon="search" title="Ninguna oferta con estos filtros">
              <p>Probá quitar alguno de los filtros.</p>
            </StateView>
          ) : (
            <>
              <ol className="recommendations">
                {filtered.slice(0, visible).map((item) => (
                  <RecommendationCard key={item.job.id} item={item} cvId={cvId} />
                ))}
              </ol>
              {filtered.length > visible && (
                <div className="load-more">
                  <button
                    type="button"
                    className="button button--outlined"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  >
                    Mostrar más ({filtered.length - visible} restantes)
                  </button>
                </div>
              )}
            </>
          )}
          {hiddenCount > 0 && <LockedRecommendations count={hiddenCount} more />}
        </>
      )}
    </Page>
  );
}
