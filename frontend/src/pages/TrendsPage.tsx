import { useEffect, useState } from 'react';
import { ApiError, api, type OfferStats } from '../api/client';
import { ChartCard, ColumnChart, DonutChart, RankingChart, StackedBar } from '../components/Charts';
import { Icon, type IconName } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';
import {
  MODALITY_COLORS,
  MODALITY_LABELS,
  SENIORITY_LABELS,
  SKILL_AREAS,
  SOURCE_COLORS,
  SOURCE_NAMES,
  UNKNOWN_COLOR,
} from '../components/labels';

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

  const { totals, topSkills, skillAreas, seniority, modality, sources, topCompanies, generatedAt } =
    state.stats;
  const tiles: { icon: IconName; color: string; value: string; label: string }[] = [
    {
      icon: 'briefcase',
      color: 'var(--chart-blue)',
      value: String(totals.offers),
      label: 'ofertas activas',
    },
    {
      icon: 'building',
      color: 'var(--chart-purple)',
      value: String(totals.companies),
      label: 'empresas',
    },
    {
      icon: 'globe',
      color: 'var(--chart-green)',
      value: `${totals.remotePercent} %`,
      label: 'son remotas',
    },
    {
      icon: 'language',
      color: 'var(--chart-orange)',
      value: `${totals.englishPercent} %`,
      label: 'piden inglés',
    },
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
          <li key={tile.label} className="trend-tile" style={{ color: tile.color }}>
            <Icon name={tile.icon} size={22} />
            <span className="trend-tile__value">{tile.value}</span>
            <span className="trend-tile__label">{tile.label}</span>
          </li>
        ))}
      </ul>

      <div className="trend-grid trend-grid--2">
        <ChartCard
          title="Tecnologías más pedidas"
          icon="cpu"
          color="var(--chart-blue)"
          note="Porcentaje de ofertas que la exigen (sin contar las deseables)."
        >
          <RankingChart
            items={topSkills.map((s) => ({
              label: s.name,
              value: s.count,
              detail: `${s.percent} %`,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Empresas que más publican"
          icon="building"
          color="var(--chart-purple)"
          note="Cantidad de ofertas activas de cada empresa."
        >
          <RankingChart
            items={topCompanies.map((c) => ({
              label: c.name,
              value: c.count,
              detail: String(c.count),
            }))}
          />
        </ChartCard>
      </div>

      <div className="trend-grid trend-grid--2">
        <ChartCard
          title="Tecnologías por área"
          icon="pieChart"
          color="var(--chart-orange)"
          note="De todas las tecnologías exigidas que reconocemos, cuántas son de cada área."
        >
          <DonutChart
            centerLabel="menciones"
            parts={skillAreas.map((a) => ({
              label: SKILL_AREAS[a.area].label,
              value: a.count,
              color: SKILL_AREAS[a.area].color,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Modalidad"
          icon="monitor"
          color="var(--chart-blue)"
          note="Ofertas por modalidad de trabajo."
        >
          <DonutChart
            centerLabel="ofertas"
            parts={modality.map((m) => ({
              label: m.modality ? MODALITY_LABELS[m.modality] : 'Sin especificar',
              value: m.count,
              color: m.modality ? MODALITY_COLORS[m.modality] : UNKNOWN_COLOR,
            }))}
          />
        </ChartCard>
      </div>

      <div className="trend-grid">
        <ChartCard
          title="Seniority"
          icon="barChart"
          color="var(--chart-green)"
          note="Ofertas por nivel, con los años de experiencia que piden en promedio y cuántas piden inglés."
        >
          <ColumnChart
            columns={seniority.map((s) => ({
              label: SENIORITY_LABELS[s.level] ?? s.level,
              value: s.count,
              details: [
                s.avgExperienceYears === null
                  ? 'Años: sin datos'
                  : `${s.avgExperienceYears.toLocaleString('es-AR')} años`,
                `Inglés: ${s.englishPercent}\u00a0%`,
              ],
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Fuentes"
          icon="layers"
          color="var(--chart-red)"
          note="De dónde vienen las ofertas."
        >
          <StackedBar
            parts={sources.map((s) => ({
              label: SOURCE_NAMES[s.source] ?? s.source,
              value: s.count,
              color: SOURCE_COLORS[s.source] ?? UNKNOWN_COLOR,
            }))}
          />
        </ChartCard>
      </div>
    </Page>
  );
}
