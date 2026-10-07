import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface StateViewProps {
  icon: IconName;
  title: string;
  tone?: 'neutral' | 'error';
  children?: ReactNode;
  actions?: ReactNode;
}

/** Empty, error and informational states with a consistent layout. */
export function StateView({ icon, title, tone = 'neutral', children, actions }: StateViewProps) {
  return (
    <section className={`state-view state-view--${tone}`}>
      <span className="state-view__icon">
        <Icon name={icon} size={32} />
      </span>
      <h1 className="state-view__title">{title}</h1>
      {children && <div className="state-view__body">{children}</div>}
      {actions && <div className="state-view__actions">{actions}</div>}
    </section>
  );
}
