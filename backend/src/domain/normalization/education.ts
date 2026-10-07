import type { EducationLevel } from '../enums.js';
import { foldText } from '../text.js';

// Order matters: "Tecnicatura Universitaria" is tertiary, not university.
const LEVEL_PATTERNS: readonly (readonly [EducationLevel, RegExp])[] = [
  [
    'POSTGRADUATE',
    /\b(maestria|master|magister|mba|posgrado|postgrado|doctorado|phd|especializacion)\b/,
  ],
  ['TERTIARY', /\b(tecnicatura|tecnico superior|terciario|analista|profesorado)\b/],
  [
    'UNIVERSITY',
    /\b(ingenieria|ingeniero|licenciatura|licenciado|universitario|universitaria|carrera de grado|titulo de grado|bachelor|degree)\b/,
  ],
  ['SECONDARY', /\b(secundario|secundaria|bachiller|polimodal|high school|perito mercantil)\b/],
];

/** Detects an explicitly stated education level in a line of text. */
export function detectEducationLevel(text: string): EducationLevel | null {
  const folded = foldText(text);
  for (const [level, pattern] of LEVEL_PATTERNS) {
    if (pattern.test(folded)) return level;
  }
  return null;
}

// Fields of study related to computing/IT ("carreras afines a informática").
const COMPUTING_FIELD =
  /\b(sistemas|informatica|computacion|computer|computing|software|programacion|programador|desarrollo de software|desarrollo web|ciencias? de datos|data science|inteligencia artificial|ciberseguridad|seguridad informatica|tecnologias? de la informacion|telecomunicaciones|telematica|bioinformatica)\b/;

/** True when a degree or field of study is related to computing/IT. */
export function isComputingField(text: string): boolean {
  return COMPUTING_FIELD.test(foldText(text));
}

const DEGREE_FIELD =
  /(?:ingenier[ií]a|licenciatura|licenciado|tecnicatura|t[eé]cnico|maestr[ií]a|carrera|t[ií]tulo|grado|degree|bachelor|master|especializaci[oó]n|doctorado|analista|profesorado)(?:\s+(?:universitari[oa]|superior))?\s+(?:en|de|in|of)\s+(.{3,80})$/i;

/** "Ingeniería en Sistemas de Información" -> "Sistemas de Información". */
export function extractField(degree: string): string | null {
  const text = degree.trim();
  const m = DEGREE_FIELD.exec(text) ?? /\b(?:en|de|in|of)\s+(.{3,80})$/i.exec(text);
  const field = m?.[1]?.replace(/[()]/g, '').trim();
  return field ? field : null;
}
