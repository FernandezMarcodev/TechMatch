import type { JobSkill, Skill } from '../../domain/entities.js';
import type { MatchingConfig } from '../matching-config.js';
import { listNames, scored, unknown, type CriterionOutcome } from './outcome.js';

interface Tally {
  total: number;
  matched: string[];
  missing: string[];
}

export function evaluateSkills(
  candidateSkills: readonly Skill[],
  jobSkills: readonly JobSkill[],
  config: MatchingConfig,
): CriterionOutcome {
  if (jobSkills.length === 0) {
    return unknown('No se pudo evaluar: la oferta no especifica tecnologías reconocibles');
  }
  if (candidateSkills.length === 0) {
    return unknown('No se pudo evaluar: el CV no menciona tecnologías reconocibles');
  }

  const owned = new Set(candidateSkills.map((s) => s.normalizedName));
  const required: Tally = { total: 0, matched: [], missing: [] };
  const optional: Tally = { total: 0, matched: [], missing: [] };
  for (const skill of jobSkills) {
    const tally = skill.isRequired ? required : optional;
    tally.total += 1;
    (owned.has(skill.normalizedName) ? tally.matched : tally.missing).push(skill.name);
  }

  const { requiredSkillWeight, optionalSkillWeight } = config.skills;
  const totalWeight = required.total * requiredSkillWeight + optional.total * optionalSkillWeight;
  const matchedWeight =
    required.matched.length * requiredSkillWeight + optional.matched.length * optionalSkillWeight;
  const score = (matchedWeight / totalWeight) * 100;

  const parts: string[] = [];
  if (required.total > 0) {
    let text = `Coinciden ${required.matched.length} de ${required.total} tecnologías requeridas`;
    if (required.matched.length > 0) text += ` (${listNames(required.matched)})`;
    if (required.missing.length > 0) text += `; faltan: ${listNames(required.missing)}`;
    parts.push(text);
  }
  if (optional.total > 0) {
    const text = `${optional.matched.length} de ${optional.total} deseables`;
    parts.push(optional.matched.length > 0 ? `${text} (${listNames(optional.matched)})` : text);
  }
  const message = required.total > 0 ? parts.join('; ') : `Coinciden ${parts.join('')}`;
  return scored(score, message, config);
}
