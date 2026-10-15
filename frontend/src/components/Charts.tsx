import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/*
 * Charts for the trends dashboard, drawn with CSS (no chart library). The shapes are
 * decorative (aria-hidden): every value is also written as text next to its label.
 */

/** Card with a colored icon, a title and an optional note. */
export function ChartCard({
  title,
  icon,
  color,
  note,
  children,
}: {
  title: string;
  icon: IconName;
  /** Background of the title icon (white on color), e.g. "var(--chart-blue)". */
  color: string;
  note?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="trend-card" aria-labelledby={titleId}>
      <div className="trend-card__header">
        <span className="trend-card__icon" style={{ background: color }}>
          <Icon name={icon} size={22} />
        </span>
        <div>
          <h2 id={titleId} className="trend-card__title">
            {title}
          </h2>
          {note && <p className="body-muted trend-card__note">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const NoData = () => <p className="body-muted chart-empty">Todavía no hay datos.</p>;

export interface RankingItem {
  label: string;
  value: number;
  /** Text after the bar, e.g. "41 %". */
  detail: string;
}

/** Ranking: numbered horizontal bars, widths relative to the first one. */
export function RankingChart({ items }: { items: RankingItem[] }) {
  if (items.length === 0) return <NoData />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="ranking">
      {items.map((item, index) => (
        <li key={item.label} className="ranking__row">
          <span className={`ranking__position${index < 3 ? ' ranking__position--top' : ''}`}>
            {index + 1}
          </span>
          <span className="ranking__label">{item.label}</span>
          <span className="ranking__track" aria-hidden="true">
            <span className="ranking__bar" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="ranking__value">{item.detail}</span>
        </li>
      ))}
    </ol>
  );
}

export interface Part {
  label: string;
  value: number;
  color: string;
}

const share = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

function Legend({ parts, total }: { parts: Part[]; total: number }) {
  return (
    <ul className="chart-legend">
      {parts.map((part) => (
        <li key={part.label} className="chart-legend__item">
          <span className="chart-legend__dot" style={{ background: part.color }} />
          <span className="chart-legend__label">{part.label}</span>
          <span className="chart-legend__value">
            {part.value} · {Math.round(share(part.value, total))} %
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Parts of a whole as a ring (CSS conic-gradient), with the total in the middle. */
export function DonutChart({ parts, centerLabel }: { parts: Part[]; centerLabel: string }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return <NoData />;
  // Each part goes from the sum of the previous ones to that sum plus its own share.
  const stops = parts.map((part, index) => {
    const start = share(
      parts.slice(0, index).reduce((sum, p) => sum + p.value, 0),
      total,
    );
    return `${part.color} ${start}% ${start + share(part.value, total)}%`;
  });
  return (
    <div className="donut">
      <div
        className="donut__ring"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        aria-hidden="true"
      >
        <div className="donut__hole">
          <span className="donut__total">{total}</span>
          <span className="donut__caption">{centerLabel}</span>
        </div>
      </div>
      <Legend parts={parts} total={total} />
    </div>
  );
}

/** Parts of a whole as one bar split at 100 %. */
export function StackedBar({ parts }: { parts: Part[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return <NoData />;
  return (
    <div className="stacked">
      <div className="stacked__bar" aria-hidden="true">
        {parts.map((part) => (
          <span
            key={part.label}
            className="stacked__segment"
            style={{ width: `${share(part.value, total)}%`, background: part.color }}
          />
        ))}
      </div>
      <Legend parts={parts} total={total} />
    </div>
  );
}

export interface Column {
  label: string;
  value: number;
  /** Extra lines under the label, e.g. "4,7 años". */
  details: string[];
}

/** An ordered scale (e.g. Trainee → Manager) as vertical columns. */
export function ColumnChart({ columns }: { columns: Column[] }) {
  if (columns.length === 0) return <NoData />;
  const max = Math.max(1, ...columns.map((c) => c.value));
  return (
    <ul className="columns" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
      {columns.map((column) => (
        <li key={column.label} className="columns__item">
          <span className="columns__value">{column.value}</span>
          <span className="columns__track" aria-hidden="true">
            <span className="columns__bar" style={{ height: `${(column.value / max) * 100}%` }} />
          </span>
          <span className="columns__label">{column.label}</span>
          {column.details.map((detail) => (
            <span key={detail} className="columns__detail">
              {detail}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
