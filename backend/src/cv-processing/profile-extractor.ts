import type { CandidateProfile, Education, Experience } from '../domain/entities.js';
import type { Seniority } from '../domain/enums.js';
import { detectEducationLevel, extractField } from '../domain/normalization/education.js';
import { findLanguageMentions } from '../domain/normalization/languages.js';
import { isRecognizedLocation } from '../domain/normalization/location.js';
import { detectSeniority } from '../domain/normalization/seniority.js';
import { extractSkillsFromText, uniqueSkills } from '../domain/normalization/skills.js';
import { foldText } from '../domain/text.js';
import {
  findDateRanges,
  monthsBetween,
  toIsoDate,
  toYearMonthOf,
  totalMonths,
  type DateRange,
  type YearMonth,
} from './dates.js';
import { segment, type Sections } from './sections.js';

export type ExtractedProfile = Omit<CandidateProfile, 'id' | 'cvId'>;

const MAX_HEADER_LINE = 90;
const MAX_SUMMARY_CHARS = 1000;
const COMPANY_MARKERS =
  /\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|inc|llc|ltd|group|grupo|consulting|banco|bank|technologies|software|labs)\b/i;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function stripRange(line: string, range: DateRange): string {
  const without = line.slice(0, range.index) + line.slice(range.index + range.length);
  return without
    .replace(/[()[\]]/g, ' ')
    .replace(/^[\s|,\u2013\u2014-]+|[\s|,\u2013\u2014-]+$/g, '')
    .trim();
}

const TITLE_SEPARATOR = /\s+(?:-|\u2013|\||@|at|en)\s+/;

function splitPositionCompany(headerLines: readonly string[]): {
  position: string | null;
  company: string | null;
} {
  const parts =
    headerLines.length === 1
      ? (headerLines[0] ?? '')
          .split(TITLE_SEPARATOR)
          .map((p) => p.trim())
          .filter(Boolean)
      : headerLines.map((l) => l.trim()).filter(Boolean);
  if (parts.length === 0) return { position: null, company: null };
  if (parts.length === 1) return { position: parts[0] ?? null, company: null };
  const [first, second] = [parts[0] ?? '', parts[1] ?? ''];
  // Prefer the part with a company marker as the company; otherwise "position - company".
  if (COMPANY_MARKERS.test(first) && !COMPANY_MARKERS.test(second)) {
    return { position: second, company: first };
  }
  return { position: first, company: second };
}

interface ExperienceExtraction {
  readonly experiences: Experience[];
  readonly ranges: DateRange[];
}

/**
 * Each line with a date range starts an experience. Its title comes from the rest of that
 * line or, if empty, the (up to two) short lines right before it.
 */
function extractExperiences(lines: readonly string[], today: YearMonth): ExperienceExtraction {
  const anchors = lines
    .map((line, index) => ({ index, range: findDateRanges(line)[0] }))
    .filter((a): a is { index: number; range: DateRange } => a.range !== undefined);

  // Where each entry's title starts: on the date line itself, or 1–2 short lines above it.
  const headerStarts = anchors.map((anchor, i) => {
    if (stripRange(lines[anchor.index] ?? '', anchor.range).length >= 3) return anchor.index;
    const floor = i > 0 ? (anchors[i - 1]?.index ?? -1) + 1 : 0;
    const prev = lines[anchor.index - 1];
    if (anchor.index - 1 < floor || !prev || prev.length > MAX_HEADER_LINE) return anchor.index;
    if (TITLE_SEPARATOR.test(prev)) return anchor.index - 1;
    const prev2 = lines[anchor.index - 2];
    const twoLines =
      anchor.index - 2 >= floor && prev2 !== undefined && prev2.length <= MAX_HEADER_LINE;
    return twoLines ? anchor.index - 2 : anchor.index - 1;
  });

  const experiences: Experience[] = [];
  anchors.forEach((anchor, i) => {
    const line = lines[anchor.index] ?? '';
    const start = headerStarts[i] ?? anchor.index;
    const header =
      start === anchor.index ? [stripRange(line, anchor.range)] : lines.slice(start, anchor.index);
    const descEnd = headerStarts[i + 1] ?? lines.length;
    const description = lines
      .slice(anchor.index + 1, descEnd)
      .join('\n')
      .trim();

    const { position, company } = splitPositionCompany(header.filter((h) => h.length > 0));
    const end = anchor.range.end ?? today;
    experiences.push({
      company,
      position,
      description: description || null,
      startDate: toIsoDate(anchor.range.start),
      endDate: anchor.range.end ? toIsoDate(anchor.range.end) : null,
      years: round1(monthsBetween(anchor.range.start, end) / 12),
      skills: extractSkillsFromText([...header, description].join('\n')),
    });
  });
  return { experiences, ranges: anchors.map((a) => a.range) };
}

const EXPLICIT_YEARS =
  /(\d{1,2}(?:[.,]\d)?)\s*\+?\s*(?:anos|years)\s+(?:de\s+)?(?:experiencia|experience)/g;

function explicitExperienceYears(text: string): number | null {
  const values = [...foldText(text).matchAll(EXPLICIT_YEARS)].map((m) =>
    Number((m[1] ?? '').replace(',', '.')),
  );
  return values.length > 0 ? Math.max(...values) : null;
}

const INSTITUTION_HINT =
  /\b(universidad|instituto|escuela|colegio|facultad|university|college|school|utn|uba|itba|unlp|uade|unc)\b/i;

function extractEducation(lines: readonly string[]): Education[] {
  const result: Education[] = [];
  lines.forEach((line, i) => {
    const level = detectEducationLevel(line);
    if (!level) return;
    const range = findDateRanges(line)[0];
    let degree = range ? stripRange(line, range) : line;
    let institution: string | null = null;
    const [left, right] = degree.split(/\s+(?:-|\u2013|\||,)\s+/);
    if (right && INSTITUTION_HINT.test(right)) {
      degree = left ?? degree;
      institution = right;
    } else {
      const nextLine = lines[i + 1];
      if (nextLine && !detectEducationLevel(nextLine) && INSTITUTION_HINT.test(nextLine)) {
        const nextRange = findDateRanges(nextLine)[0];
        institution = nextRange ? stripRange(nextLine, nextRange) : nextLine;
      }
    }
    result.push({
      institution,
      degree,
      field: extractField(degree),
      level,
      startDate: range ? toIsoDate(range.start) : null,
      endDate: range?.end ? toIsoDate(range.end) : null,
    });
  });
  return result;
}

const LOCATION_LABEL =
  /^(?:ubicacion|direccion|domicilio|residencia|localidad|ciudad|location|address|lugar de residencia)\s*:\s*(.+)$/i;

function extractLocation(sections: Sections): string | null {
  const candidates = [...sections.header, ...sections.other];
  for (const line of candidates) {
    const labeled = LOCATION_LABEL.exec(foldText(line));
    if (labeled) {
      const value = line.slice(line.indexOf(':') + 1).trim();
      if (value) return value;
    }
  }
  for (const line of sections.header.slice(0, 15)) {
    for (const segment of line.split(/\s+[|\u2022\u00b7]\s+|\s+-\s+/)) {
      const s = segment.trim();
      if (s.length > 60 || /@|\d{6,}|https?:|www\./i.test(s)) continue;
      if (isRecognizedLocation(s)) return s;
    }
  }
  return null;
}

function extractSeniority(experiences: readonly Experience[], sections: Sections): Seniority {
  const latest = [...experiences].sort((a, b) => {
    const endA = a.endDate ?? '9999';
    const endB = b.endDate ?? '9999';
    return endB.localeCompare(endA) || (b.startDate ?? '').localeCompare(a.startDate ?? '');
  })[0];
  const sources = [
    latest?.position ?? '',
    ...sections.header.slice(0, 3),
    sections.summary[0] ?? '',
  ];
  for (const source of sources) {
    const s = detectSeniority(source);
    if (s !== 'UNKNOWN') return s;
  }
  return 'UNKNOWN';
}

/**
 * Builds a structured profile from cleaned CV text using explicit evidence only.
 * Anything not stated in the CV stays null / UNKNOWN / empty.
 */
export function extractProfile(text: string, referenceDate: Date): ExtractedProfile {
  const sections = segment(text);
  const today = toYearMonthOf(referenceDate);

  const { experiences, ranges } = extractExperiences(sections.experience, today);
  const months = totalMonths(ranges, today);
  const totalExperienceYears =
    ranges.length > 0 ? round1(months / 12) : explicitExperienceYears(text);

  let languages = findLanguageMentions(sections.languages, false);
  if (languages.length === 0) languages = findLanguageMentions(text.split('\n'), true);

  const summary = sections.summary.join(' ').slice(0, MAX_SUMMARY_CHARS).trim();

  return {
    summary: summary || null,
    seniority: extractSeniority(experiences, sections),
    totalExperienceYears,
    location: extractLocation(sections),
    experiences,
    education: extractEducation(sections.education),
    skills: uniqueSkills([...extractSkillsFromText(text), ...experiences.flatMap((e) => e.skills)]),
    languages,
  };
}
