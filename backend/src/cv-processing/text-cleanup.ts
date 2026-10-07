const BULLET_PREFIX = /^[\u2022\u25aa\u25cf\u25e6\u2023\u2043\u2219\u00b7*\u2013\u2014-]+\s*/;

/** Normalizes extracted text: unicode, control chars, bullets, hyphenation, blank lines. */
export function cleanText(raw: string): string {
  const normalized = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]/g, ' ')
    // Re-join words hyphenated across a line break ("desa-\nrrollo").
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2');

  const lines = normalized
    .split('\n')
    .map((line) => line.replace(BULLET_PREFIX, '').replace(/ {2,}/g, ' ').trim());

  const out: string[] = [];
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Count of meaningful characters, used to decide whether OCR is needed. */
export function meaningfulLength(text: string): number {
  return text.replace(/[^\p{L}\p{N}]/gu, '').length;
}
