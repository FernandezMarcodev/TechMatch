import type { Modality } from '../../domain/enums.js';
import { compareLocations, normalizeLocation } from '../../domain/normalization/location.js';
import type { MatchingConfig } from '../matching-config.js';
import { scored, unknown, type CriterionOutcome } from './outcome.js';

/** Location states from docs/03-MATCHING-SPEC.md § Ubicación. */
export type LocationState = 'SAME_CITY' | 'SAME_REGION' | 'REMOTE' | 'UNKNOWN' | 'INCOMPATIBLE';

export function resolveLocationState(
  candidateLocation: string | null,
  jobLocation: string | null,
  modality: Modality,
): LocationState {
  if (modality === 'REMOTE') return 'REMOTE';
  return compareLocations(normalizeLocation(candidateLocation), normalizeLocation(jobLocation));
}

export function evaluateLocation(
  state: LocationState,
  jobLocation: string | null,
  config: MatchingConfig,
): CriterionOutcome {
  const where = jobLocation ? ` (${jobLocation})` : '';
  switch (state) {
    case 'REMOTE':
      return scored(
        config.location.remote,
        'Trabajo remoto: la ubicación no es una restricción',
        config,
      );
    case 'SAME_CITY':
      return scored(config.location.sameCity, `Misma ciudad que la oferta${where}`, config);
    case 'SAME_REGION':
      return scored(config.location.sameRegion, `Misma región que la oferta${where}`, config);
    case 'INCOMPATIBLE':
      return scored(config.location.incompatible, `La oferta es en otra región${where}`, config);
    case 'UNKNOWN':
      return unknown('No se pudo comparar la ubicación del CV con la de la oferta');
  }
}

const MODALITY_LABELS: Readonly<Record<Exclude<Modality, 'UNKNOWN'>, string>> = {
  REMOTE: 'remota',
  HYBRID: 'híbrida',
  ONSITE: 'presencial',
};

/**
 * A remote job is compatible unless there is an incompatible geographic restriction.
 * Hybrid/onsite jobs are compatible when the candidate is within commuting range.
 */
export function evaluateModality(
  modality: Modality,
  state: LocationState,
  config: MatchingConfig,
): CriterionOutcome {
  if (modality === 'UNKNOWN') return unknown('La oferta no especifica la modalidad');
  const label = MODALITY_LABELS[modality];
  if (modality === 'REMOTE') {
    return scored(config.modality.remote, 'Modalidad remota compatible', config);
  }
  switch (state) {
    case 'SAME_CITY':
    case 'SAME_REGION':
      return scored(
        config.modality.commutable,
        `Modalidad ${label} compatible con la ubicación del CV`,
        config,
      );
    case 'INCOMPATIBLE':
      return scored(
        config.modality.incompatible,
        `Modalidad ${label} en una región distinta a la del CV`,
        config,
      );
    default:
      return unknown(`Modalidad ${label}: no se pudo verificar la ubicación del CV`);
  }
}
