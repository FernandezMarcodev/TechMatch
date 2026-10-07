import { foldText } from '../text.js';

export interface NormalizedLocation {
  readonly city: string | null;
  readonly region: string | null;
}

export type LocationRelation = 'SAME_CITY' | 'SAME_REGION' | 'INCOMPATIBLE' | 'UNKNOWN';

const CABA_ALIASES = new Set([
  'caba',
  'c.a.b.a',
  'capital federal',
  'ciudad autonoma de buenos aires',
  'ciudad de buenos aires',
]);

// Argentine provinces (folded) with common variants. CABA is grouped with Buenos Aires
// as one commuting region.
const REGION_ALIASES: Readonly<Record<string, string>> = {
  'buenos aires': 'buenos aires',
  'provincia de buenos aires': 'buenos aires',
  'bs as': 'buenos aires',
  'bs. as': 'buenos aires',
  bsas: 'buenos aires',
  gba: 'buenos aires',
  'gran buenos aires': 'buenos aires',
  amba: 'buenos aires',
  catamarca: 'catamarca',
  chaco: 'chaco',
  chubut: 'chubut',
  cordoba: 'cordoba',
  corrientes: 'corrientes',
  'entre rios': 'entre rios',
  formosa: 'formosa',
  jujuy: 'jujuy',
  'la pampa': 'la pampa',
  'la rioja': 'la rioja',
  mendoza: 'mendoza',
  misiones: 'misiones',
  neuquen: 'neuquen',
  'rio negro': 'rio negro',
  salta: 'salta',
  'san juan': 'san juan',
  'san luis': 'san luis',
  'santa cruz': 'santa cruz',
  'santa fe': 'santa fe',
  'santiago del estero': 'santiago del estero',
  'tierra del fuego': 'tierra del fuego',
  tucuman: 'tucuman',
  // Other countries are regions of their own: an onsite job abroad is not commutable.
  chile: 'pais:chile',
  uruguay: 'pais:uruguay',
  paraguay: 'pais:paraguay',
  bolivia: 'pais:bolivia',
  brasil: 'pais:brasil',
  brazil: 'pais:brasil',
  peru: 'pais:peru',
  colombia: 'pais:colombia',
  ecuador: 'pais:ecuador',
  venezuela: 'pais:venezuela',
  mexico: 'pais:mexico',
  espana: 'pais:espana',
  spain: 'pais:espana',
  'estados unidos': 'pais:estados unidos',
  'united states': 'pais:estados unidos',
  usa: 'pais:estados unidos',
};

const IGNORED_SEGMENTS = new Set(['argentina', 'republica argentina', '']);

export function normalizeLocation(raw: string | null): NormalizedLocation {
  if (!raw) return { city: null, region: null };
  const segments = raw
    .split(/[,|/]| - /)
    .map((s) => foldText(s).replace(/\.$/, ''))
    .filter((s) => !IGNORED_SEGMENTS.has(s));

  if (segments.length === 0) return { city: null, region: null };
  if (segments.some((s) => CABA_ALIASES.has(s))) return { city: 'caba', region: 'buenos aires' };

  const last = segments[segments.length - 1] ?? '';
  const region = REGION_ALIASES[last] ?? null;
  if (segments.length === 1) {
    return region ? { city: null, region } : { city: last, region: null };
  }
  return { city: segments[0] ?? null, region: region ?? last };
}

/** True when the text is clearly a place we know (CABA or an Argentine province). */
export function isRecognizedLocation(raw: string): boolean {
  const n = normalizeLocation(raw);
  if (n.city === 'caba') return true;
  return n.region !== null && Object.values(REGION_ALIASES).includes(n.region);
}

/** Compares two locations without assuming compatibility when information is missing. */
export function compareLocations(a: NormalizedLocation, b: NormalizedLocation): LocationRelation {
  if (a.city && b.city && a.city === b.city) return 'SAME_CITY';
  if (a.region && b.region) return a.region === b.region ? 'SAME_REGION' : 'INCOMPATIBLE';
  return 'UNKNOWN';
}
