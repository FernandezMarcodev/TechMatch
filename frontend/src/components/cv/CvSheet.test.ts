import { describe, expect, it } from 'vitest';
import { pageBreaks } from './CvSheet';

const MM = 96 / 25.4;
const TOP = 16 * MM;
const PAGE = 265 * MM; // A4 height minus the top and bottom margins

const block = (top: number, bottom: number, kind: 'entry' | 'heading' | 'paragraph' = 'entry') => ({
  top,
  bottom,
  keepTogether: kind !== 'paragraph',
  heading: kind === 'heading',
});

describe('pageBreaks', () => {
  it('has no breaks when everything fits on one page', () => {
    expect(pageBreaks([block(TOP, TOP + 100), block(TOP + 110, TOP + 400)], TOP)).toEqual([]);
  });

  it('moves an entry that does not fit to the next page', () => {
    const entry = block(TOP + PAGE - 50, TOP + PAGE + 30);
    expect(pageBreaks([block(TOP, TOP + 100), entry], TOP)).toEqual([entry.top]);
  });

  it('keeps a section title with the entry that follows it', () => {
    const heading = block(TOP + PAGE - 60, TOP + PAGE - 40, 'heading');
    const entry = block(TOP + PAGE - 35, TOP + PAGE + 40);
    expect(pageBreaks([block(TOP, TOP + 100), heading, entry], TOP)).toEqual([heading.top]);
  });

  it('breaks a paragraph at the end of the page', () => {
    const paragraph = block(TOP + PAGE - 20, TOP + PAGE + 20, 'paragraph');
    expect(pageBreaks([block(TOP, TOP + 100), paragraph], TOP)).toEqual([TOP + PAGE]);
  });

  it('counts several pages', () => {
    const blocks = Array.from({ length: 30 }, (_, i) => block(TOP + i * 90, TOP + i * 90 + 80));
    expect(pageBreaks(blocks, TOP).length).toBe(2);
  });
});
