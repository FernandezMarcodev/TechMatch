import { useLayoutEffect, useRef, useState } from 'react';
import type { CvDocument } from '../../api/client';
import { CvPreview } from './CvPreview';

/** CSS pixels per millimetre (96 dpi). */
const PX_PER_MM = 96 / 25.4;
/** A4 and the print margins of `@page` in app.css: the sheet reproduces the printed page. */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_Y_MM = 16;
const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_MM - 2 * MARGIN_Y_MM) * PX_PER_MM;
const PAGE_WIDTH_PX = PAGE_WIDTH_MM * PX_PER_MM;

interface Block {
  top: number;
  bottom: number;
  /** Printed with `break-inside: avoid`: a page break moves the whole block. */
  keepTogether: boolean;
  /** A section title stays with the block that follows it (`break-after: avoid`). */
  heading: boolean;
}

function blocksOf(paper: HTMLElement): Block[] {
  const elements = paper.querySelectorAll<HTMLElement>(
    '.cv-paper__header, .cv-paper__section > h2, .cv-paper__section > p, .cv-paper__entry',
  );
  return [...elements].map((el) => ({
    top: el.offsetTop,
    bottom: el.offsetTop + el.offsetHeight,
    keepTogether: el.tagName !== 'P',
    heading: el.tagName === 'H2',
  }));
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

function sameBreaks(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.5);
}

/**
 * The CV preview as a real A4 sheet: same width, margins and font sizes as the exported PDF
 * (so lines wrap the same way), scaled down to fit the column, with the page breaks marked.
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
  const [breaks, setBreaks] = useState<number[]>([]);

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
    setHeight(paper.offsetHeight);
    const next = pageBreaks(blocksOf(paper), MARGIN_Y_MM * PX_PER_MM);
    setBreaks((current) => (sameBreaks(current, next) ? current : next));
  }, [doc]);

  const pages = breaks.length + 1;
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
          {breaks.map((top, i) => (
            <div key={i} className="cv-sheet__break" style={{ top }} aria-hidden="true">
              <span>Página {i + 2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
