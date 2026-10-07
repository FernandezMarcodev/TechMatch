import type {
  Education,
  EducationRequirement,
  Language,
  LanguageRequirement,
} from '../../domain/entities.js';
import { educationLevelRank, languageLevelRank, type EducationLevel } from '../../domain/enums.js';
import { isComputingField } from '../../domain/normalization/education.js';
import { foldText } from '../../domain/text.js';
import type { MatchingConfig } from '../matching-config.js';
import {
  EDUCATION_LABELS,
  languageLabel,
  notRequired,
  scored,
  unknown,
  type CriterionOutcome,
} from './outcome.js';

function highestLevel(education: readonly Education[]): EducationLevel | null {
  let best: EducationLevel | null = null;
  for (const item of education) {
    if (
      item.level &&
      (best === null || educationLevelRank(item.level) > educationLevelRank(best))
    ) {
      best = item.level;
    }
  }
  return best;
}

function describe(item: Education): string {
  return item.degree ?? item.field ?? '';
}

function isComputing(item: Education): boolean {
  return [item.degree, item.field].some((t) => (t ? isComputingField(t) : false));
}

/**
 * Two fields match when one contains the other, or when both are computing-related
 * ("Sistemas" required, "Ciencias de la Computación" studied).
 */
function fieldMatches(education: readonly Education[], fields: readonly string[]): boolean | null {
  const candidateFields = education
    .flatMap((e) => [e.field, e.degree])
    .filter((f): f is string => Boolean(f));
  if (candidateFields.length === 0) return null;
  const wanted = fields.map(foldText);
  const wantsComputing = fields.some(isComputingField);
  return candidateFields.some((raw) => {
    const c = foldText(raw);
    return (
      wanted.some((w) => c.includes(w) || w.includes(c)) ||
      (wantsComputing && isComputingField(raw))
    );
  });
}

/**
 * The offer states no education requirement: value the candidate's education instead of
 * treating everyone alike. Computing degrees count most; any engineering or licenciatura
 * implies a general base.
 */
function valueEducation(education: readonly Education[], config: MatchingConfig): CriterionOutcome {
  const table = config.education.withoutRequirement;
  let best: { score: number; message: string } | null = null;
  for (const item of education) {
    if (!item.level) continue;
    const computing = isComputing(item);
    const name = describe(item);
    const detail = name ? ` (${name})` : '';
    let candidate: { score: number; message: string };
    if (item.level === 'UNIVERSITY' || item.level === 'POSTGRADUATE') {
      const level = item.level === 'POSTGRADUATE' ? 'Posgrado' : 'Título universitario';
      candidate = computing
        ? { score: table.universityComputing, message: `${level} afín a informática${detail}` }
        : { score: table.universityOther, message: `${level}${detail}: aporta una base general` };
    } else if (item.level === 'TERTIARY') {
      candidate = computing
        ? {
            score: table.tertiaryComputing,
            message: `Formación terciaria afín a informática${detail}`,
          }
        : { score: table.tertiaryOther, message: `Formación terciaria${detail}` };
    } else {
      candidate = { score: table.secondary, message: 'El CV indica nivel secundario' };
    }
    if (!best || candidate.score > best.score) best = candidate;
  }
  if (!best) {
    return unknown('La oferta no exige educación y el CV no permite determinar el nivel');
  }
  return scored(best.score, best.message, config);
}

export function evaluateEducation(
  education: readonly Education[],
  requirement: EducationRequirement | null,
  config: MatchingConfig,
): CriterionOutcome {
  if (!requirement || (requirement.level === null && requirement.fields.length === 0)) {
    return valueEducation(education, config);
  }
  if (education.length === 0) {
    return unknown('La oferta especifica educación; el CV no permite determinarla');
  }

  let score = 100;
  const notes: string[] = [];
  if (requirement.level) {
    const candidateLevel = highestLevel(education);
    const required = EDUCATION_LABELS[requirement.level];
    if (!candidateLevel) {
      return unknown(`La oferta requiere nivel ${required}; el CV no permite determinar el nivel`);
    }
    const gap = educationLevelRank(requirement.level) - educationLevelRank(candidateLevel);
    score = gap <= 0 ? 100 : gap === 1 ? config.education.oneLevelBelowScore : 0;
    notes.push(
      gap <= 0
        ? `Cumple el nivel educativo requerido (${required})`
        : `La oferta requiere nivel ${required} y el CV indica ${EDUCATION_LABELS[candidateLevel]}`,
    );
  }
  if (requirement.fields.length > 0) {
    const matches = fieldMatches(education, requirement.fields);
    if (matches === false) {
      score *= config.education.fieldMismatchFactor;
      notes.push(`el área de estudio no coincide con ${requirement.fields.join(' / ')}`);
    } else if (matches === true) {
      notes.push('el área de estudio coincide');
    }
  }
  const message = notes.join('; ');
  return scored(score, message.charAt(0).toUpperCase() + message.slice(1), config);
}

export function evaluateLanguages(
  languages: readonly Language[],
  requirements: readonly LanguageRequirement[],
  config: MatchingConfig,
): CriterionOutcome {
  if (requirements.length === 0) {
    return notRequired('La oferta no exige idiomas');
  }
  if (languages.length === 0) {
    return unknown('La oferta exige idiomas; el CV no menciona idiomas');
  }

  const scores: number[] = [];
  const notes: string[] = [];
  for (const req of requirements) {
    const label = languageLabel(req.name);
    const owned = languages.find((l) => l.name === req.name);
    if (!owned) {
      scores.push(0);
      notes.push(`no se menciona ${label}${req.level ? ` ${req.level}` : ''}`);
      continue;
    }
    if (!req.level) {
      scores.push(100);
      notes.push(`maneja ${label}`);
      continue;
    }
    if (!owned.level) {
      notes.push(`se requiere ${label} ${req.level}; el CV no indica el nivel`);
      continue;
    }
    const ratio = (languageLevelRank(owned.level) + 1) / (languageLevelRank(req.level) + 1);
    scores.push(Math.min(1, ratio) * 100);
    notes.push(
      ratio >= 1
        ? `${label} ${owned.level} cumple el nivel ${req.level}`
        : `se requiere ${label} ${req.level} y el CV indica ${owned.level}`,
    );
  }

  const message = notes.join('; ');
  const capitalized = message.charAt(0).toUpperCase() + message.slice(1);
  if (scores.length === 0) return unknown(capitalized);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  return scored(average, capitalized, config);
}
