import { readFileSync } from 'node:fs';
import {
  DEFAULT_MATCHING_CONFIG,
  parseMatchingConfig,
  type MatchingConfig,
} from '../matching/matching-config.js';

/**
 * Loads matching weights/thresholds. Defaults come from docs/03-MATCHING-SPEC.md; an
 * optional JSON file can override whole sections (e.g. {"thresholds": {...}}).
 */
export function loadMatchingConfig(filePath: string | undefined): MatchingConfig {
  if (!filePath) return DEFAULT_MATCHING_CONFIG;
  const overrides = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  return parseMatchingConfig({ ...DEFAULT_MATCHING_CONFIG, ...overrides });
}
