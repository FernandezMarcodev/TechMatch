import * as cheerio from 'cheerio';

/** Converts an HTML fragment to plain text, keeping paragraph and list structure as lines. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  $('script, style').remove();
  $('br').replaceWith('\n');
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr').each((_, el) => {
    $(el).append('\n');
  });
  return $('#root')
    .text()
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
