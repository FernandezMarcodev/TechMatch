import type { MatchLevel, Modality, SkillArea } from '../api/client';
import type { IconName } from './Icon';

export const MODALITY_LABELS: Record<Exclude<Modality, null>, string> = {
  REMOTE: 'Remoto',
  HYBRID: 'Híbrido',
  ONSITE: 'Presencial',
};

export const MODALITY_ICONS: Record<Exclude<Modality, null>, IconName> = {
  REMOTE: 'globe',
  HYBRID: 'laptop',
  ONSITE: 'home',
};

export const SENIORITY_LABELS: Record<string, string> = {
  INTERN: 'Trainee',
  JUNIOR: 'Junior',
  SEMI_SENIOR: 'Semi Senior',
  SENIOR: 'Senior',
  LEAD: 'Lead',
  MANAGER: 'Manager',
};

/**
 * Chart colors (classic palette in styles/tokens.css). A category keeps its color everywhere:
 * remote is always green, hybrid yellow, onsite blue.
 */
export const MODALITY_COLORS: Record<Exclude<Modality, null>, string> = {
  REMOTE: 'var(--chart-green)',
  HYBRID: 'var(--chart-yellow)',
  ONSITE: 'var(--chart-blue)',
};

export const UNKNOWN_COLOR = 'var(--chart-gray)';

export const SOURCE_COLORS: Record<string, string> = {
  getonboard: 'var(--chart-blue)',
  lever: 'var(--chart-green)',
  greenhouse: 'var(--chart-orange)',
};

export const SKILL_AREAS: Record<SkillArea, { label: string; color: string }> = {
  LANGUAGES: { label: 'Lenguajes', color: 'var(--chart-blue)' },
  BACKEND: { label: 'Backend', color: 'var(--chart-green)' },
  CLOUD_DEVOPS: { label: 'Cloud y DevOps', color: 'var(--chart-orange)' },
  DATA: { label: 'Datos', color: 'var(--chart-purple)' },
  FRONTEND: { label: 'Frontend', color: 'var(--chart-yellow)' },
  PRACTICES: { label: 'Metodologías y herramientas', color: 'var(--chart-red)' },
};

/** Short source names for charts ("Publicada en …" uses SOURCES[…].label). */
export const SOURCE_NAMES: Record<string, string> = {
  getonboard: 'Get on Board',
  lever: 'Empresas en Lever',
  greenhouse: 'Empresas en Greenhouse',
};

export const LEVEL_LABELS: Record<MatchLevel, string> = {
  HIGH: 'Alta compatibilidad',
  MEDIUM: 'Compatibilidad media',
  LOW: 'Compatibilidad baja',
};

export const SOURCES: Record<string, { label: string; url: string }> = {
  getonboard: { label: 'Get on Board', url: 'https://www.getonbrd.com' },
  lever: { label: 'la página de empleos de la empresa (Lever)', url: 'https://www.lever.co' },
  greenhouse: {
    label: 'la página de empleos de la empresa (Greenhouse)',
    url: 'https://www.greenhouse.com',
  },
};

export const CRITERIA: Record<string, { label: string; icon: IconName; description: string }> = {
  // Listed in matching priority order.
  skills: {
    label: 'Tecnologías',
    icon: 'code',
    description: 'Lenguajes, frameworks y herramientas que pide la oferta.',
  },
  seniority: {
    label: 'Seniority',
    icon: 'trending',
    description: 'De trainee a líder, comparado con el nivel buscado.',
  },
  experience: {
    label: 'Experiencia',
    icon: 'clock',
    description: 'Años de experiencia que surgen de tu CV.',
  },
  education: {
    label: 'Educación',
    icon: 'school',
    description:
      'Las carreras afines a informática suman más; una ingeniería o licenciatura aporta base general.',
  },
  languages: {
    label: 'Idiomas',
    icon: 'language',
    description: 'Idiomas y niveles (A1 a C2 o nativo) requeridos.',
  },
  location: {
    label: 'Ubicación',
    icon: 'pin',
    description: 'Ciudad o región, salvo en trabajos remotos.',
  },
  modality: {
    label: 'Modalidad',
    icon: 'laptop',
    description: 'Remoto, híbrido o presencial según dónde estés.',
  },
};

/** CEFR codes are shown as is; NATIVE is "Nativo". */
export function languageLevelLabel(level: string): string {
  return level === 'NATIVE' ? 'Nativo' : level;
}

export function modalityLabel(modality: Modality): string | null {
  return modality ? MODALITY_LABELS[modality] : null;
}

export function sourceLabel(source: string): string {
  return SOURCES[source]?.label ?? source;
}
