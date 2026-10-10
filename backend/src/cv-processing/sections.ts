import { foldText } from '../domain/text.js';

export type SectionName =
  'header' | 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'languages' | 'other';

const HEADINGS: readonly (readonly [SectionName, readonly string[]])[] = [
  [
    'summary',
    [
      'perfil',
      'perfil profesional',
      'resumen',
      'resumen profesional',
      'sobre mi',
      'acerca de mi',
      'objetivo',
      'objetivo profesional',
      'summary',
      'profile',
      'about me',
    ],
  ],
  [
    'experience',
    [
      'experiencia',
      'experiencia laboral',
      'experiencia profesional',
      'antecedentes laborales',
      'historial laboral',
      'trayectoria',
      'trayectoria profesional',
      'experience',
      'work experience',
      'professional experience',
      'employment history',
    ],
  ],
  [
    'education',
    [
      'educacion',
      'formacion',
      'formacion academica',
      'estudios',
      'estudios cursados',
      'education',
      'academic background',
    ],
  ],
  [
    'projects',
    [
      'proyectos',
      'proyectos personales',
      'proyectos destacados',
      'proyectos academicos',
      'proyectos propios',
      'proyectos relevantes',
      'projects',
      'personal projects',
      'side projects',
      'portfolio',
      'portafolio',
    ],
  ],
  [
    'skills',
    [
      'habilidades',
      'habilidades tecnicas',
      'conocimientos',
      'conocimientos tecnicos',
      'aptitudes',
      'competencias',
      'tecnologias',
      'herramientas',
      'skills',
      'technical skills',
      'tech stack',
      'stack tecnologico',
    ],
  ],
  ['languages', ['idiomas', 'idioma', 'languages', 'language']],
  [
    'other',
    [
      'cursos',
      'certificaciones',
      'cursos y certificaciones',
      'certifications',
      'courses',
      'referencias',
      'references',
      'intereses',
      'interests',
      'voluntariado',
      'datos personales',
      'contacto',
      'contact',
      'logros',
      'premios',
    ],
  ],
];

const headingIndex: ReadonlyMap<string, SectionName> = new Map(
  HEADINGS.flatMap(([section, words]) => words.map((w) => [w, section] as const)),
);

/** Returns the section a line introduces, if it is a heading (short, matches a known title). */
export function headingOf(line: string): SectionName | null {
  if (line.length > 40) return null;
  const key = foldText(line)
    .replace(/[:.\-_|]+$/g, '')
    .trim();
  return headingIndex.get(key) ?? null;
}

export type Sections = Readonly<Record<SectionName, readonly string[]>>;

/** Splits CV lines into sections. Lines before the first heading form the header. */
export function segment(text: string): Sections {
  const sections: Record<SectionName, string[]> = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    other: [],
  };
  let current: SectionName = 'header';
  for (const line of text.split('\n')) {
    const heading = headingOf(line);
    if (heading) {
      current = heading;
      continue;
    }
    if (line.trim()) sections[current].push(line);
  }
  return sections;
}
