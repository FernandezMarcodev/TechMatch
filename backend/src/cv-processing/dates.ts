export interface YearMonth {
  readonly year: number;
  readonly month: number; // 1-12
}

export interface DateRange {
  readonly start: YearMonth;
  /** null = ongoing ("actualidad", "presente"). */
  readonly end: YearMonth | null;
  /** Position of the match in the original line, so it can be removed from it. */
  readonly index: number;
  readonly length: number;
}

/** Lowercase without diacritics, preserving string length for NFC input. */
function foldSameLength(value: string): string {
  return value
    .normalize('NFC')
    .split('')
    .map((ch) => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || ch)
    .join('')
    .toLowerCase();
}

const MONTHS: Readonly<Record<string, number>> = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  set: 9,
  septiembre: 9,
  setiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

// Year-only dates are taken as mid-year so "2019 - 2021" counts 2 years.
const YEAR_ONLY_MONTH = 6;

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');
const DATE = `(?:(?:(?<![a-z])(${MONTH_PATTERN})\\.?\\s*(?:de\\s+|del\\s+)?)|(?<!\\d)(\\d{1,2})\\s*[/.-]\\s*)?(?<!\\d)((?:19|20)\\d{2})(?!\\d)`;
const ONGOING = '(actualidad|actual|presente|present|current|hoy|la fecha|today|now)';
const RANGE = new RegExp(
  `${DATE}\\s*(?:-|\\u2013|\\u2014|a|al|hasta|to)\\s*(?:${DATE}|${ONGOING})`,
  'g',
);

function toYearMonth(
  monthWord: string | undefined,
  monthNum: string | undefined,
  year: string,
): YearMonth | null {
  const y = Number(year);
  if (monthWord) return { year: y, month: MONTHS[monthWord] ?? YEAR_ONLY_MONTH };
  if (monthNum) {
    const m = Number(monthNum);
    return m >= 1 && m <= 12 ? { year: y, month: m } : null;
  }
  return { year: y, month: YEAR_ONLY_MONTH };
}

/** Finds date ranges like "Mar 2020 - Actualidad", "2018 – 2021", "01/2019 a 12/2020". */
export function findDateRanges(line: string): DateRange[] {
  const text = foldSameLength(line);
  const ranges: DateRange[] = [];
  for (const m of text.matchAll(RANGE)) {
    const start = toYearMonth(m[1], m[2], m[3] ?? '');
    if (!start) continue;
    let end: YearMonth | null = null;
    if (!m[7]) {
      end = toYearMonth(m[4], m[5], m[6] ?? '');
      if (!end) continue;
      if (end.year * 12 + end.month < start.year * 12 + start.month) continue;
    }
    ranges.push({ start, end, index: m.index, length: m[0].length });
  }
  return ranges;
}

function toMonthIndex(ym: YearMonth): number {
  return ym.year * 12 + (ym.month - 1);
}

export function monthsBetween(start: YearMonth, end: YearMonth): number {
  return Math.max(0, toMonthIndex(end) - toMonthIndex(start));
}

export function toYearMonthOf(date: Date): YearMonth {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Total months covered by the ranges, counting overlaps once. */
export function totalMonths(ranges: readonly DateRange[], today: YearMonth): number {
  const intervals = ranges
    .map((r) => [toMonthIndex(r.start), toMonthIndex(r.end ?? today)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [s, e] of intervals) {
    if (current && s <= current[1]) {
      current[1] = Math.max(current[1], e);
    } else {
      if (current) total += current[1] - current[0];
      current = [s, e];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

export function toIsoDate(ym: YearMonth): string {
  return `${ym.year}-${String(ym.month).padStart(2, '0')}-01`;
}
