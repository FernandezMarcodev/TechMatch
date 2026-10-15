import { useEffect, useId, useState } from 'react';
import { ApiError, api, type OfferStats } from '../api/client';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';
import { MODALITY_LABELS, SENIORITY_LABELS, SOURCE_NAMES } from '../components/labels';

interface Bar {
  label: string;
  value: number;
  /** Text after the bar, e.g. "41 %" or "12 ofertas". */
  detail: string;
}

/** Horizontal bars drawn with CSS (no chart library). Widths are relative to the largest. */
function BarChart({ title, bars, note }: { title: string; bars: Bar[]; note?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const titleId = useId();
  return (
    <section className="trend-card" aria-labelledby={titleId}>
      <h2 id={titleId} className="trend-card__title">
        {title}
      </h2>
      {note && <p className="body-muted trend-card__note">{note}</p>}
      {bars.length === 0 ? (
        <p className="body-muted">Todavía no hay datos.</p>
      ) : (
        <ul className="bar-chart">
          {bars.map((bar) => (
            <li key={bar.label} className="bar-chart__row">
              <span className="bar-chart__label">{bar.label}</span>
              <span className="bar-chart__track" aria-hidden="true">
                <span className="bar-chart__bar" style={{ width: `${(bar.value / max) * 100}%` }} />
              </span>
              <span className="bar-chart__value">{bar.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; stats: OfferStats };

/** Public dashboard: what the tech market is asking for, from the active offers. */
export function TrendsPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getOfferStats()
      .then((stats) => {
        if (!cancelled) setState({ kind: 'ready', stats });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'No pudimos cargar las tendencias.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Calculando tendencias…</p>
        </div>
      </Page>
    );
  }
  if (state.kind === 'error') {
    return (
      <Page narrow>
        <StateView icon="alert" tone="error" title="No pudimos cargar las tendencias">
          <p role="alert">{state.message}</p>
        </StateView>
      </Page>
    );
  }

  const { totals, topSkills, seniority, modality, sources, topCompanies, generatedAt } =
    state.stats;
  const tiles: {
    icon: 'briefcase' | 'home' | 'globe' | 'language';
    value: string;
    label: string;
  }[] = [
    { icon: 'briefcase', value: String(totals.offers), label: 'ofertas activas' },
    { icon: 'home', value: String(totals.companies), label: 'empresas' },
    { icon: 'globe', value: `${totals.remotePercent} %`, label: 'son remotas' },
    { icon: 'language', value: `${totals.englishPercent} %`, label: 'piden inglés' },
  ];
  const updated = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(generatedAt));

  return (
    <Page>
      <header className="page-header">
        <div>
          <h1 className="headline-large">Tendencias del mercado tech</h1>
          <p className="body-muted">
            Qué piden las ofertas activas que analiza TechMatch · Actualizado el {updated}
          </p>
        </div>
      </header>

      <ul className="trend-tiles">
        {tiles.map((tile) => (
          <li key={tile.label} className="trend-tile">
            <Icon name={tile.icon} size={22} />
            <span className="trend-tile__value">{tile.value}</span>
            <span className="trend-tile__label">{tile.label}</span>
          </li>
        ))}
      </ul>

      <div className="trend-grid trend-grid--2">
        <BarChart
          title="Tecnologías más pedidas"
          note="Porcentaje de ofertas que la exigen (sin contar las deseables)."
          bars={topSkills.map((s) => ({ label: s.name, value: s.count, detail: `${s.percent} %` }))}
        />
        <BarChart
          title="Empresas que más publican"
          note="Cantidad de ofertas activas de cada empresa."
          bars={topCompanies.map((c) => ({
            label: c.name,
            value: c.count,
            detail: String(c.count),
          }))}
        />
      </div>
      <div className="trend-grid trend-grid--3">
        <BarChart
          title="Seniority"
          note="Ofertas por nivel y años de experiencia que piden en promedio."
          bars={seniority.map((s) => ({
            label: SENIORITY_LABELS[s.level] ?? s.level,
            value: s.count,
            detail:
              s.avgExperienceYears === null
                ? String(s.count)
                : `${s.count} · ${s.avgExperienceYears.toLocaleString('es-AR')} años`,
          }))}
        />
        <BarChart
          title="Modalidad"
          note="Ofertas por modalidad de trabajo."
          bars={modality.map((m) => ({
            label: m.modality ? MODALITY_LABELS[m.modality] : 'Sin especificar',
            value: m.count,
            detail: String(m.count),
          }))}
        />
        <BarChart
          title="Fuentes"
          note="De dónde vienen las ofertas."
          bars={sources.map((s) => ({
            label: SOURCE_NAMES[s.source] ?? s.source,
            value: s.count,
            detail: String(s.count),
          }))}
        />
      </div>
    </Page>
  );
}
