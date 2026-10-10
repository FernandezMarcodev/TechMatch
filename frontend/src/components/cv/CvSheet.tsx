import { useLayoutEffect, useRef, useState } from 'react';
import type { CvDocument } from '../../api/client';
import { CvPreview } from './CvPreview';

/** CSS pixels per millimetre (96 dpi). */
const PX_PER_MM = 96 / 25.4;
/** A4 and the page margins (the sheet's padding in app.css): the sheet is the printed page. */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_Y_MM = 16;
const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_MM - 2 * MARGIN_Y_MM) * PX_PER_MM;
const PAGE_WIDTH_PX = PAGE_WIDTH_MM * PX_PER_MM;
const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM * PX_PER_MM;
const MARGIN_Y_PX = MARGIN_Y_MM * PX_PER_MM;
/** Space between two sheets on screen; must match --cv-sheet-gap in app.css. */
const SHEET_GAP_PX = 10 * PX_PER_MM;

interface Block {
  top: number;
  bottom: number;
  /** Printed with `break-inside: avoid`: a page break moves the whole block. */
  keepTogether: boolean;
  /** A section title stays with the block that follows it (`break-after: avoid`). */
  heading: boolean;
}

const BLOCKS =
  '.cv-paper__header, .cv-paper__section > h2, .cv-paper__section > p, .cv-paper__entry';

/** Every block is printed with `break-inside: avoid` (see the print stylesheet). */
function blocksOf(elements: readonly HTMLElement[]): Block[] {
  return elements.map((el) => ({
    top: el.offsetTop,
    bottom: el.offsetTop + el.offsetHeight,
    keepTogether: true,
    heading: el.tagName === 'H2',
  }));
}

/**
 * Lays the content out on separate A4 sheets: the block that starts each new page is pushed
 * down (padding) to the top margin of the next sheet. The same marked blocks
 * (`data-page-start`) get a forced page break when printing, so the PDF has the same pages.
 * Returns the number of pages.
 */
export function paginate(paper: HTMLElement): number {
  for (const el of paper.querySelectorAll<HTMLElement>('[data-page-start]')) {
    el.style.paddingTop = '';
    delete el.dataset.pageStart;
  }
  paper.style.minHeight = '';
  const elements = [...paper.querySelectorAll<HTMLElement>(BLOCKS)];
  // Measured once, before any padding moves the blocks.
  const blocks = blocksOf(elements);
  const breaks = pageBreaks(blocks, MARGIN_Y_PX);
  let shift = 0;
  breaks.forEach((at, i) => {
    const el = elements[blocks.findIndex((b) => Math.abs(b.top - at) < 0.5)];
    if (!el) return; // a block taller than a page: it keeps flowing
    const sheetTop = (i + 1) * (PAGE_HEIGHT_PX + SHEET_GAP_PX) + MARGIN_Y_PX;
    const space = sheetTop - (at + shift);
    el.dataset.pageStart = '';
    el.style.paddingTop = `${space}px`;
    shift += space;
  });
  const pages = breaks.length + 1;
  paper.style.minHeight = `${pages * PAGE_HEIGHT_PX + (pages - 1) * SHEET_GAP_PX}px`;
  return pages;
}

/**
 * Where the printed pages break, as offsets inside the sheet. Mirrors the print stylesheet:
 * a block that does not fit moves to the next page (with its section title), unless it is
 * taller than a page or a paragraph, which break at the end of the page.
 */
export function pageBreaks(blocks: readonly Block[], firstContentTop: number): number[] {
  const breaks: number[] = [];
  let pageStart = firstContentTop;
  blocks.forEach((block, i) => {
    while (block.bottom > pageStart + CONTENT_HEIGHT_PX) {
      const previous = blocks[i - 1];
      let at =
        block.keepTogether && block.top > pageStart ? block.top : pageStart + CONTENT_HEIGHT_PX;
      if (at === block.top && previous?.heading && previous.top > pageStart) at = previous.top;
      breaks.push(at);
      pageStart = at;
    }
  });
  return breaks;
}

/**
 * The CV preview as real A4 sheets: same width, margins and font sizes as the exported PDF (so
 * lines wrap the same way), split into pages where the printer splits them, scaled to fit.
 */
export function CvSheet({
  document: doc,
  onExpand,
}: {
  document: CvDocument;
  /** Shows the "Ampliar" button. */
  onExpand?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);
  const [pages, setPages] = useState(1);

  // Fit the sheet to the available width.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const width = frame.clientWidth;
      if (width > 0) setScale(Math.min(1, width / PAGE_WIDTH_PX));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Measure after every edit: height of the sheet and where the pages break.
  useLayoutEffect(() => {
    const paper = sheetRef.current?.querySelector<HTMLElement>('.cv-paper');
    if (!paper || paper.offsetHeight === 0) return;
    setPages(paginate(paper));
    setHeight(paper.offsetHeight);
  }, [doc]);

  return (
    <div className="cv-sheet">
      <div className="cv-sheet__caption">
        <span>Tamaño A4, igual que el PDF · {pages === 1 ? '1 página' : `${pages} páginas`}</span>
        {onExpand && (
          <button type="button" className="button button--text button--small" onClick={onExpand}>
            Ampliar
          </button>
        )}
      </div>
      <div
        ref={frameRef}
        className="cv-sheet__frame"
        style={height === null ? undefined : { height: height * scale }}
      >
        <div ref={sheetRef} className="cv-sheet__scaled" style={{ transform: `scale(${scale})` }}>
          <CvPreview document={doc} />
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div
              key={i}
              className="cv-sheet__gap"
              style={{ top: (i + 1) * (PAGE_HEIGHT_PX + SHEET_GAP_PX) - SHEET_GAP_PX }}
              aria-hidden="true"
            >
              Página {i + 2}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
