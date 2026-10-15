import { useId, useState } from 'react';
import type { MatchReason } from '../api/client';
import { Icon, type IconName } from './Icon';
import { CRITERIA } from './labels';

const STATUS_ICON: Record<MatchReason['status'], IconName> = {
  positive: 'check',
  partial: 'minus',
  negative: 'close',
  neutral: 'minus',
};

const SUMMARY_SIZE = 3;

const STATUS_ORDER: Record<MatchReason['status'], number> = {
  negative: 0,
  partial: 1,
  positive: 2,
  neutral: 3,
};

/**
 * The technologies reason first, then mismatches, partial matches and matches: what matters
 * most to decide.
 */
function highlights(reasons: MatchReason[]): MatchReason[] {
  const skills = reasons.filter((r) => r.criterion === 'skills');
  const rest = reasons.filter((r) => r.criterion !== 'skills' && r.status !== 'neutral');
  rest.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return [...skills, ...rest].slice(0, SUMMARY_SIZE);
}

function Reason({ reason }: { reason: MatchReason }) {
  return (
    <li className={`reason reason--${reason.status}`}>
      <span className="reason__icon">
        <Icon name={STATUS_ICON[reason.status]} size={16} />
      </span>
      <span className="reason__text">
        <strong>{CRITERIA[reason.criterion]?.label ?? reason.criterion}:</strong> {reason.message}
      </span>
    </li>
  );
}

export function ReasonList({ reasons }: { reasons: MatchReason[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const visible = expanded ? reasons : highlights(reasons);
  return (
    <div className="reasons">
      <ul className="reasons__list" id={listId}>
        {visible.map((reason) => (
          <Reason key={reason.criterion} reason={reason} />
        ))}
      </ul>
      {reasons.length > visible.length || expanded ? (
        <button
          type="button"
          className="button button--text button--small reasons__toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ver resumen' : 'Ver análisis completo'}
          <Icon name="chevronDown" size={18} className={expanded ? 'rotate' : undefined} />
        </button>
      ) : null}
    </div>
  );
}
