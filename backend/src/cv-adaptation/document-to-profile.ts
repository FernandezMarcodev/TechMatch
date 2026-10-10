import { explicitExperienceYears } from '../cv-processing/profile-extractor.js';
import {
  monthsBetween,
  toIsoDate,
  toYearMonthOf,
  totalMonths,
  type DateRange,
  type YearMonth,
} from '../cv-processing/dates.js';
import type { CandidateProfile, Education, Experience, Language } from '../domain/entities.js';
import { LANGUAGE_LEVEL_ORDER, type LanguageLevel } from '../domain/enums.js';
import { detectEducationLevel, extractField } from '../domain/normalization/education.js';
import { normalizeLanguageName } from '../domain/normalization/languages.js';
import { detectSeniority } from '../domain/normalization/seniority.js';
import {
  extractSkillsFromText,
  normalizeSkill,
  uniqueSkills,
} from '../domain/normalization/skills.js';
import type { EvaluationDocument } from './document-schema.js';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseMonth(date: string | null): YearMonth | null {
  if (!date) return null;
  const [year, month] = date.split('-');
  return { year: Number(year), month: month ? Number(month) : 1 };
}

function asLevel(level: string | null): LanguageLevel | null {
  const upper = level?.trim().toUpperCase();
  return LANGUAGE_LEVEL_ORDER.find((l) => l === upper) ?? null;
}

/**
 * Turns the edited CV back into a CandidateProfile using the same normalization as CV
 * processing (aliases, keywords, date ranges → years), so the unchanged matching engine can
 * evaluate it. As with an uploaded CV, technologies mentioned in the text also count.
 */
export function documentToProfile(
  doc: EvaluationDocument,
  ids: { id: string; cvId: string },
  referenceDate: Date,
): CandidateProfile {
  const today = toYearMonthOf(referenceDate);
  const ranges: DateRange[] = [];

  const experiences: Experience[] = doc.experiences.map((e) => {
    const start = parseMonth(e.startDate);
    const end = parseMonth(e.endDate);
    if (start) ranges.push({ start, end, index: 0, length: 0 });
    const text = [e.position ?? '', ...e.highlights].join('\n');
    return {
      company: e.company,
      position: e.position,
      description: e.highlights.filter((h) => h.trim()).join('\n') || null,
      startDate: start ? toIsoDate(start) : null,
      endDate: end ? toIsoDate(end) : null,
      years: start ? round1(monthsBetween(start, end ?? today) / 12) : null,
      skills: extractSkillsFromText(text),
    };
  });

  const allText = [
    doc.personal.headline ?? '',
    doc.summary,
    ...doc.experiences.flatMap((e) => [e.position ?? '', ...e.highlights]),
    ...doc.projects.flatMap((p) => [p.name ?? '', ...p.highlights]),
  ].join('\n');

  const skills = uniqueSkills([
    ...doc.skills.map((s) => normalizeSkill(s.name)).filter((s) => s !== null),
    ...extractSkillsFromText(allText),
  ]);

  const seniority =
    [doc.personal.headline ?? '', doc.experiences[0]?.position ?? '', doc.summary]
      .map(detectSeniority)
      .find((s) => s !== 'UNKNOWN') ?? 'UNKNOWN';

  const education: Education[] = doc.education
    .filter((e) => e.degree || e.institution)
    .map((e) => {
      const degree = e.degree ?? '';
      return {
        institution: e.institution,
        degree: e.degree,
        field: degree ? extractField(degree) : null,
        level: detectEducationLevel(degree) ?? detectEducationLevel(e.institution ?? ''),
        startDate: e.startDate ? `${e.startDate.slice(0, 4)}-01-01` : null,
        endDate: e.endDate ? `${e.endDate.slice(0, 4)}-01-01` : null,
      };
    });

  const languages: Language[] = doc.languages
    .filter((l) => l.name.trim())
    .map((l) => ({
      name: normalizeLanguageName(l.name) ?? l.name.trim(),
      level: asLevel(l.level),
    }));

  return {
    ...ids,
    summary: doc.summary.trim() || null,
    seniority,
    totalExperienceYears:
      ranges.length > 0
        ? round1(totalMonths(ranges, today) / 12)
        : explicitExperienceYears(allText),
    location: doc.personal.location?.trim() || null,
    experiences,
    education,
    projects: doc.projects
      .filter((p) => p.name || p.highlights.some((h) => h.trim()))
      .map((p) => {
        const start = parseMonth(p.startDate);
        const end = parseMonth(p.endDate);
        return {
          name: p.name,
          description: p.highlights.filter((h) => h.trim()).join('\n') || null,
          startDate: start ? toIsoDate(start) : null,
          endDate: end ? toIsoDate(end) : null,
        };
      }),
    skills,
    languages,
  };
}
