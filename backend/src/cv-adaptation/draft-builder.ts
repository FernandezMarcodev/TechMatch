import type { CandidateProfile, Experience, JobOffer } from '../domain/entities.js';
import { isKnownSeniority, languageLevelRank } from '../domain/enums.js';
import { formatLanguageLevel } from '../domain/normalization/languages.js';
import { extractSkillsFromText } from '../domain/normalization/skills.js';
import { foldText } from '../domain/text.js';
import {
  EDUCATION_LABELS,
  SENIORITY_LABELS,
  formatYears,
  languageLabel,
} from '../matching/criteria/outcome.js';
import type {
  AdaptationSuggestion,
  AdaptedDraft,
  CvDocument,
  CvDocumentEducation,
  CvDocumentExperience,
  CvDocumentProject,
} from './types.js';

const SUMMARY_SKILLS = 4;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinWithY(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** "2021-03-01" → "2021-03"; year-only education dates → "2019". */
function toMonth(date: string | null): string | null {
  return date ? date.slice(0, 7) : null;
}

function toYear(date: string | null): string | null {
  return date ? date.slice(0, 4) : null;
}

/** Most recent first: ongoing jobs, then by end and start date. */
function byRecency(a: Experience, b: Experience): number {
  const endA = a.endDate ?? '9999';
  const endB = b.endDate ?? '9999';
  return endB.localeCompare(endA) || (b.startDate ?? '').localeCompare(a.startDate ?? '');
}

function skillKeysIn(text: string): Set<string> {
  return new Set(extractSkillsFromText(text).map((s) => s.normalizedName));
}

/**
 * Builds the adapted draft (docs/15-ADAPTACION-DE-CV.md). Deterministic and pure: it only
 * reorders, highlights and phrases what the profile already contains. Whatever the offer
 * asks for and the CV lacks becomes a suggestion, never content.
 */
export function buildAdaptedDraft(profile: CandidateProfile, job: JobOffer): AdaptedDraft {
  const owned = new Set(profile.skills.map((s) => s.normalizedName));
  const required = job.skills.filter((s) => s.isRequired);
  const optional = job.skills.filter((s) => !s.isRequired);
  const jobKeys = new Set(job.skills.map((s) => s.normalizedName));

  // Technologies: matching required, matching optional, then the rest alphabetically.
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const matchedRequired = profile.skills
    .filter((s) => required.some((r) => r.normalizedName === s.normalizedName))
    .sort(byName);
  const matchedOptional = profile.skills
    .filter((s) => optional.some((o) => o.normalizedName === s.normalizedName))
    .sort(byName);
  const rest = profile.skills.filter((s) => !jobKeys.has(s.normalizedName)).sort(byName);
  const skills = [
    ...matchedRequired.map((s) => ({ name: s.name, highlighted: true })),
    ...matchedOptional.map((s) => ({ name: s.name, highlighted: true })),
    ...rest.map((s) => ({ name: s.name, highlighted: false })),
  ];

  const mentionsJob = (text: string) => [...skillKeysIn(text)].some((k) => jobKeys.has(k));
  // Lines with technologies of the offer first; otherwise keep the CV's order.
  const highlightsOf = (description: string | null) => {
    const lines = (description ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return [...lines.filter(mentionsJob), ...lines.filter((l) => !mentionsJob(l))];
  };

  const experiences: CvDocumentExperience[] = [...profile.experiences].sort(byRecency).map((e) => ({
    position: e.position,
    company: e.company,
    startDate: toMonth(e.startDate),
    endDate: toMonth(e.endDate),
    highlights: highlightsOf(e.description),
    relevant: mentionsJob([e.position ?? '', e.description ?? ''].join('\n')),
  }));

  // Projects related to the offer first; otherwise the CV's order. Years only, like education:
  // projects are often dated by year and a month must not be invented.
  const allProjects: CvDocumentProject[] = profile.projects.map((p) => ({
    name: p.name,
    startDate: toYear(p.startDate),
    endDate: toYear(p.endDate),
    highlights: highlightsOf(p.description),
    relevant: mentionsJob([p.name ?? '', p.description ?? ''].join('\n')),
  }));
  const projects = [
    ...allProjects.filter((p) => p.relevant),
    ...allProjects.filter((p) => !p.relevant),
  ];

  const education: CvDocumentEducation[] = profile.education.map((e) => ({
    degree: e.degree,
    institution: e.institution,
    startDate: toYear(e.startDate),
    endDate: toYear(e.endDate),
  }));

  const headline = experiences[0]?.position ?? null;

  const document: CvDocument = {
    personal: {
      fullName: '',
      headline,
      email: '',
      phone: '',
      location: profile.location,
      links: [],
    },
    summary: buildSummary(profile, headline, [...matchedRequired, ...matchedOptional]),
    experiences,
    education,
    projects,
    skills,
    languages: profile.languages.map((l) => ({
      name: capitalize(languageLabel(l.name)),
      level: l.level,
    })),
  };

  return { document, suggestions: buildSuggestions(profile, job, owned) };
}

/** "{Título} {Seniority} con {N} años de experiencia en {tecnologías}." — only real data. */
function buildSummary(
  profile: CandidateProfile,
  headline: string | null,
  matched: readonly { name: string }[],
): string {
  const title = headline ?? 'Profesional';
  const seniority = isKnownSeniority(profile.seniority)
    ? SENIORITY_LABELS[profile.seniority]
    : null;
  const showSeniority = seniority && !foldText(title).includes(foldText(seniority));
  const years =
    profile.totalExperienceYears !== null && profile.totalExperienceYears >= 1
      ? Math.floor(profile.totalExperienceYears)
      : null;
  const skills = matched.slice(0, SUMMARY_SKILLS).map((s) => s.name);

  if (years === null && skills.length === 0) {
    return profile.summary ?? `${title}${showSeniority ? ` ${seniority}` : ''}.`;
  }
  let text = title;
  if (showSeniority) text += ` ${seniority}`;
  text += years !== null ? ` con ${formatYears(years)} de experiencia` : ' con experiencia';
  if (skills.length > 0) text += ` en ${joinWithY(skills)}`;
  return `${text}.`;
}

function buildSuggestions(
  profile: CandidateProfile,
  job: JobOffer,
  owned: ReadonlySet<string>,
): AdaptationSuggestion[] {
  const suggestions: AdaptationSuggestion[] = [];
  for (const skill of job.skills.filter((s) => s.isRequired && !owned.has(s.normalizedName))) {
    suggestions.push({
      type: 'MISSING_REQUIRED_SKILL',
      skill: skill.name,
      message: `La oferta pide ${skill.name}. Si tenés experiencia, agregala.`,
    });
  }
  for (const skill of job.skills.filter((s) => !s.isRequired && !owned.has(s.normalizedName))) {
    suggestions.push({
      type: 'MISSING_OPTIONAL_SKILL',
      skill: skill.name,
      message: `Suma conocer ${skill.name} (deseable). Si lo manejás, agregalo.`,
    });
  }

  for (const req of job.languageRequirements) {
    const label = languageLabel(req.name);
    const wanted = req.level ? `${label} ${formatLanguageLevel(req.level)}` : label;
    const own = profile.languages.find((l) => l.name === req.name);
    if (!own) {
      suggestions.push({
        type: 'LANGUAGE',
        message: `La oferta pide ${wanted}. Si lo manejás, indicalo con tu nivel.`,
      });
    } else if (req.level && !own.level) {
      suggestions.push({
        type: 'LANGUAGE',
        message: `Indicá tu nivel de ${label}: la oferta pide ${formatLanguageLevel(req.level)}.`,
      });
    } else if (
      req.level &&
      own.level &&
      languageLevelRank(own.level) < languageLevelRank(req.level)
    ) {
      suggestions.push({
        type: 'LANGUAGE',
        message: `La oferta pide ${wanted} y tu CV indica ${formatLanguageLevel(own.level)}. Si tu nivel es mayor, actualizalo.`,
      });
    }
  }

  const requiredYears = job.experienceYearsMin;
  if (requiredYears !== null && requiredYears > 0) {
    if (profile.totalExperienceYears === null) {
      suggestions.push({
        type: 'MISSING_DATA',
        message: `La oferta pide ${formatYears(requiredYears)} de experiencia y no pudimos calcular la tuya: revisá las fechas de tus trabajos.`,
      });
    } else if (profile.totalExperienceYears < requiredYears) {
      suggestions.push({
        type: 'EXPERIENCE',
        message: `La oferta pide ${formatYears(requiredYears)} de experiencia y tu CV indica ${formatYears(profile.totalExperienceYears)}. Destacá los proyectos más relevantes.`,
      });
    }
  }

  if (isKnownSeniority(job.seniority) && !isKnownSeniority(profile.seniority)) {
    suggestions.push({
      type: 'MISSING_DATA',
      message: `La oferta busca un perfil ${SENIORITY_LABELS[job.seniority]} y no pudimos detectar tu seniority. Indicalo en tu título.`,
    });
  }

  const educationLevel = job.educationRequirements?.level;
  if (educationLevel && profile.education.length === 0) {
    suggestions.push({
      type: 'MISSING_DATA',
      message: `La oferta pide formación de nivel ${EDUCATION_LABELS[educationLevel]}. Si la tenés, agregala en Educación.`,
    });
  }
  return suggestions;
}
