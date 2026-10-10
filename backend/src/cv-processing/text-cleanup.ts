import { findDateRanges } from './dates.js';
import { headingOf } from './sections.js';

/**
 * Bullet markers seen in CVs: typographic bullets, squares, arrows, check marks, dashes and the
 * private-use glyphs Word exports for Symbol/Wingdings bullets (U+F0B7, U+F0A7, U+F0D8...).
 */
const BULLET_PREFIX =
  /^[\u2022\u2023\u2043\u2219\u2217\u00b7\u25aa\u25ab\u25a0\u25a1\u25b6\u25b8\u25ba\u25c6\u25c7\u25cb\u25cf\u25e6\u2192\u2794\u27a2\u27a4\u2713\u2714\u2756\u2666\u00a7\uf076\uf0a7\uf0a8\uf0b7\uf0d8\uf0e0\uf0fc*\u2013\u2014-]+\s*/;

/** A wrapped line fills most of the text width; shorter lines are their own item. */
const MIN_WRAPPED_LENGTH = 40;
const SENTENCE_END = /[.!?;:]$/;
const CONNECTOR_END =
  /(?:,|\b(?:de|del|la|las|el|los|en|con|para|por|y|e|o|u|a|al|que|sobre|entre|como|su|sus|un|una|of|the|and|or|to|with|for|in|on|at|by|an))$/i;
const CONTACT = /@|https?:|www\./i;

/**
 * Whether `line` is the rest of a sentence the PDF wrapped from `prev`: `prev` is long and
 * unfinished, and `line` starts in lowercase or `prev` ends with a comma or a connector.
 */
function continuesPrevious(prev: string, line: string): boolean {
  if (prev.length < MIN_WRAPPED_LENGTH || SENTENCE_END.test(prev)) return false;
  if (CONTACT.test(line) || headingOf(line) || findDateRanges(line).length > 0) return false;
  return /^\p{Ll}/u.test(line) || CONNECTOR_END.test(prev);
}

/**
 * Normalizes extracted text: unicode, control chars, hyphenation, blank lines and bullets.
 * Bullet markers are removed and each item ends up on a single line: a sentence the PDF
 * wrapped over several lines is joined back, so it is never shown as two items.
 */
export function cleanText(raw: string): string {
  const normalized = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]/g, ' ')
    // Re-join words hyphenated across a line break ("desa-\nrrollo").
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2');

  const out: string[] = [];
  // A marker alone on its line (drawn on a different baseline): the next line starts an item.
  let pendingBullet = false;
  for (const rawLine of normalized.split('\n')) {
    const collapsed = rawLine.replace(/ {2,}/g, ' ').trim();
    const marker = BULLET_PREFIX.exec(collapsed);
    const line = marker ? collapsed.slice(marker[0].length).trim() : collapsed;
    if (marker && line === '') {
      pendingBullet = true;
      continue;
    }
    if (line === '') {
      pendingBullet = false;
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const startsItem = marker !== null || pendingBullet;
    pendingBullet = false;
    const prev = out[out.length - 1];
    if (!startsItem && prev && continuesPrevious(prev, line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Count of meaningful characters, used to decide whether OCR is needed. */
export function meaningfulLength(text: string): number {
  return text.replace(/[^\p{L}\p{N}]/gu, '').length;
}
