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

/** Groups positioned text items into lines (top-to-bottom, left-to-right) per page. */
function toLines(items: { str: string; x: number; y: number }[]): string[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - item.y) < 2);
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
