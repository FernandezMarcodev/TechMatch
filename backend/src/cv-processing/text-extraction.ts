import { extractTextItems, getDocumentProxy } from 'unpdf';
import { AppError } from '../application/errors.js';

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

export interface TextExtractor {
  /** Throws PDF_NOT_PROCESSABLE when the document cannot be parsed (corrupt, encrypted...). */
  assertReadable(content: Buffer): Promise<void>;
  /** Throws PDF_NOT_PROCESSABLE when the document cannot be parsed (corrupt, encrypted...). */
  extract(content: Buffer): Promise<string>;
}

/** Optional OCR fallback for scanned PDFs. */
export interface OcrProvider {
  readonly enabled: boolean;
  recognize(content: Buffer): Promise<string>;
}

/**
 * OCR is optional in the MVP (RF-006 "podrá"). Rendering PDF pages to images in Node needs
 * a native canvas plus an OCR engine; until that is justified the provider is disabled and
 * scanned PDFs fail with a clear status instead of producing invented data.
 */
export const disabledOcr: OcrProvider = {
  enabled: false,
  recognize: () => Promise.resolve(''),
};

async function openPdf(content: Buffer): Promise<PdfDocument> {
  try {
    return await getDocumentProxy(new Uint8Array(content));
  } catch {
    throw new AppError(
      'PDF_NOT_PROCESSABLE',
      'No se pudo leer el PDF. Verificá que no esté dañado ni protegido.',
    );
  }
}

/** Minimum vertical distance (PDF units) between two separate lines. */
const MIN_ROW_TOLERANCE = 2;

/**
 * Groups positioned text items into lines (top-to-bottom, left-to-right) per page. Items
 * closer than half their font size vertically share a line: bullet glyphs and mixed fonts are
 * often drawn a few units off the text baseline, and must not become lines of their own.
 */
export function toLines(
  items: { str: string; x: number; y: number; fontSize?: number }[],
): string[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const tolerance = Math.max(MIN_ROW_TOLERANCE, (item.fontSize ?? 0) / 2);
    const row = rows.find((r) => Math.abs(r.y - item.y) < tolerance);
    if (row) row.parts.push({ x: item.x, str: item.str });
    else rows.push({ y: item.y, parts: [{ x: item.x, str: item.str }] });
  }
  return rows
    .sort((a, b) => b.y - a.y) // PDF y grows upwards
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
}

export class PdfTextExtractor implements TextExtractor {
  async assertReadable(content: Buffer): Promise<void> {
    const pdf = await openPdf(content);
    await pdf.loadingTask.destroy();
  }

  async extract(content: Buffer): Promise<string> {
    const pdf = await openPdf(content);
    try {
      const { items } = await extractTextItems(pdf);
      return items.map((pageItems) => toLines(pageItems).join('\n')).join('\n\n');
    } catch {
      throw new AppError('PDF_NOT_PROCESSABLE', 'No se pudo extraer el texto del PDF.');
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
}
