import type { NormalizedJobOffer } from '../application/ports.js';
import type { EducationRequirement, JobSkill, LanguageRequirement } from '../domain/entities.js';
import type { Modality, Seniority } from '../domain/enums.js';
import { detectEducationLevel, extractField } from '../domain/normalization/education.js';
import { findLanguageMentions } from '../domain/normalization/languages.js';
import { detectSeniority } from '../domain/normalization/seniority.js';
import {
  extractSkillsFromText,
  normalizeSkill,
  uniqueSkills,
} from '../domain/normalization/skills.js';
import { foldText } from '../domain/text.js';
import type { RawJobOffer } from './types.js';

const MAX_DESCRIPTION_CHARS = 20_000;
const MAX_FIELD_CHARS = 255;
const UNKNOWN_COMPANY = 'Empresa no especificada';

const OPTIONAL_MARKERS =
  /\b(deseable|deseables|valorable|valorables|se valorara|plus|suma|sumara|nice to have|preferentemente|no excluyente)\b/;

function parseModality(raw: RawJobOffer): Modality {
  const explicit = foldText(raw.modality ?? '');
  const fromText = (text: string): Modality | null => {
    if (/\b(hibrid[oa]|hybrid)\b/.test(text)) return 'HYBRID';
    if (/\b(remot[oa]|remote|home office|teletrabajo|100% remoto)\b/.test(text)) return 'REMOTE';
    if (/\b(presencial|on[\s-]?site)\b/.test(text)) return 'ONSITE';
    return null;
  };
  if (explicit) return fromText(explicit) ?? 'UNKNOWN';
  const title = fromText(foldText(raw.title));
  if (title) return title;
  const modalityLine = /modalidad(?: de trabajo)?\s*:?\s*([^\n.]{0,40})/.exec(
    foldText(raw.description ?? ''),
  );
  return (modalityLine?.[1] && fromText(modalityLine[1])) || 'UNKNOWN';
}

function parseSeniority(raw: RawJobOffer, requirementLines: readonly string[]): Seniority {
  // Declared field first, then title; descriptions are too noisy ("lead", "senior partners"...).
  for (const text of [raw.seniority ?? '', raw.title, ...requirementLines]) {
    const s = detectSeniority(text);
    if (s !== 'UNKNOWN') return s;
  }
  return 'UNKNOWN';
}

const YEARS_PATTERNS = [
  /(\d{1,2})\s*\+?\s*(?:anos|years)\s+(?:de\s+|of\s+)?(?:experiencia|experience)/g,
  /experiencia\s+(?:minima\s+|comprobable\s+)?(?:de\s+)?(?:al menos\s+)?(\d{1,2})\s*\+?\s*anos/g,
  /al menos\s+(\d{1,2})\s+anos/g,
  /(\d{1,2})\s*\+?\s*anos\s+(?:desarrollando|trabajando|programando|como)\b/g,
];

export function parseExperienceYears(text: string): number | null {
  const folded = foldText(text);
  const values = YEARS_PATTERNS.flatMap((re) => [...folded.matchAll(re)].map((m) => Number(m[1])));
  const valid = values.filter((v) => v > 0 && v <= 30);
  return valid.length > 0 ? Math.max(...valid) : null;
}

function parseEducation(lines: readonly string[]): EducationRequirement | null {
  for (const line of lines) {
    const level = detectEducationLevel(line);
    if (!level) continue;
    const field = extractField(line.split(/[.;(]/)[0] ?? line);
    return { level, fields: field ? [field.slice(0, 80)] : [] };
  }
  return null;
}

/** A short line without technologies or final period, e.g. "Requisitos" or "Conocimientos deseables". */
function isSectionHeading(line: string): boolean {
  const text = line.trim();
  return (
    text.split(/\s+/).length <= 5 && !/[.]$/.test(text) && extractSkillsFromText(text).length === 0
  );
}

/**
 * Splits text lines into required and nice-to-have. A line is optional when it carries an
 * optional marker ("Deseable: Docker") or sits under an optional heading ("Conocimientos
 * deseables") until the next heading.
 */
function classifyLines(lines: readonly string[]): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  let inOptionalSection = false;
  for (const line of lines) {
    const hasMarker = OPTIONAL_MARKERS.test(foldText(line));
    if (isSectionHeading(line)) {
      inOptionalSection = hasMarker;
      continue;
    }
    (inOptionalSection || hasMarker ? optional : required).push(line);
  }
  return { required, optional };
}

function parseSkills(raw: RawJobOffer, lines: readonly string[]): JobSkill[] {
  const classified = classifyLines(lines);
  const keysIn = (texts: readonly string[]) =>
    new Map(extractSkillsFromText(texts.join('\n')).map((s) => [s.normalizedName, s] as const));
  const requiredText = keysIn([raw.title, ...classified.required]);
  const optionalText = keysIn([...classified.optional, ...(raw.desirable ?? [])]);

  const skills = new Map<string, JobSkill>();
  // Published tags are required unless the offer mentions them only as nice-to-haves.
  for (const tag of raw.skills ?? []) {
    const skill = normalizeSkill(tag);
    if (!skill) continue;
    const onlyOptional =
      optionalText.has(skill.normalizedName) && !requiredText.has(skill.normalizedName);
    skills.set(skill.normalizedName, { ...skill, isRequired: !onlyOptional });
  }
  for (const [key, skill] of requiredText) skills.set(key, { ...skill, isRequired: true });
  for (const [key, skill] of optionalText) {
    if (!skills.has(key)) skills.set(key, { ...skill, isRequired: false });
  }
  return uniqueSkills(skills.values());
}

function clip(value: string | null | undefined, max: number): string | null {
  const v = value?.replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
}

/** Turns a source-specific raw offer into the common model used by persistence and matching. */
export function normalizeJobOffer(raw: RawJobOffer): NormalizedJobOffer {
  const description = (raw.description ?? '').trim().slice(0, MAX_DESCRIPTION_CHARS);
  const requirements = (raw.requirements ?? []).map((r) => r.trim()).filter(Boolean);
  const lines = [...requirements, ...description.split('\n')].filter(Boolean);
  // When the source lists requirements separately, read experience/education/languages only
  // from them: descriptions talk about the company ("9 años de experiencia en el mercado").
  const requirementLines = requirements.length > 0 ? requirements : lines;
  const languageRequirements: LanguageRequirement[] = findLanguageMentions(requirementLines, false);

  return {
    externalId: clip(raw.externalId, MAX_FIELD_CHARS),
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    title: clip(raw.title, 500) ?? raw.sourceUrl,
    company: clip(raw.company, MAX_FIELD_CHARS) ?? UNKNOWN_COMPANY,
    location: clip(raw.location, MAX_FIELD_CHARS),
    modality: parseModality(raw),
    description,
    requirements,
    skills: parseSkills(raw, lines),
    seniority: parseSeniority(raw, requirements),
    experienceYearsMin: parseExperienceYears(requirementLines.join('\n')),
    educationRequirements: parseEducation(requirementLines),
    languageRequirements,
    publishedAt: raw.publishedAt ?? null,
  };
}
