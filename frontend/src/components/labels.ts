import type { MatchLevel, Modality } from '../api/client';
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

export const LEVEL_LABELS: Record<MatchLevel, string> = {
  HIGH: 'Alta compatibilidad',
  MEDIUM: 'Compatibilidad media',
  LOW: 'Compatibilidad baja',
};

export const SOURCES: Record<string, { label: string; url: string }> = {
  getonboard: { label: 'Get on Board', url: 'https://www.getonbrd.com' },
};

export const CRITERIA: Record<string, { label: string; icon: IconName; description: string }> = {
  // Listed in matching priority order.
  skills: {
    label: 'Tecnologías',
    icon: 'code',
    description: 'Lo más importante: lenguajes, frameworks y herramientas que pide la oferta.',
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
    description: 'Idiomas y niveles (A1 a C2) requeridos.',
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

export function modalityLabel(modality: Modality): string | null {
  return modality ? MODALITY_LABELS[modality] : null;
}

export function sourceLabel(source: string): string {
  return SOURCES[source]?.label ?? source;
}
