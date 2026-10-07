import type { MatchLevel } from '../api/client';
import { LEVEL_LABELS } from './labels';

const FILLED_BARS: Record<MatchLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/**
 * Qualitative match indicator (signal bars). The numeric score stays internal: users see
 * how good the match is, not a number to over-interpret.
 */
export function LevelMeter({ level }: { level: MatchLevel }) {
  const filled = FILLED_BARS[level];
  return (
    <div
      className={`level-meter level-meter--${level.toLowerCase()}`}
      role="img"
      aria-label={LEVEL_LABELS[level]}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`level-meter__bar${bar <= filled ? ' level-meter__bar--on' : ''}`}
        />
      ))}
    </div>
  );
}

export function LevelChip({ level }: { level: MatchLevel }) {
  return (
    <span className={`level-chip level-chip--${level.toLowerCase()}`}>{LEVEL_LABELS[level]}</span>
  );
}
