import { AppError } from '../application/errors.js';

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
/** The PDF spec tolerates a little garbage before the header; Acrobat accepts 1024 bytes. */
const SIGNATURE_SEARCH_WINDOW = 1024;

export interface UploadedFile {
  readonly originalName: string;
  readonly declaredMimeType: string;
  readonly content: Buffer;
}

/**
 * Validates an upload by its content, not by the client-declared MIME type or extension.
 * Whether the PDF can actually be parsed is checked separately by the text extractor.
 */
export function validatePdfUpload(file: UploadedFile, maxSizeBytes: number): void {
  if (file.content.length === 0) {
    throw new AppError('INVALID_FILE', 'El archivo está vacío.');
  }
  if (file.content.length > maxSizeBytes) {
    throw new AppError('FILE_TOO_LARGE', 'El archivo supera el tamaño máximo permitido.', {
      maxSizeBytes,
    });
  }
  const header = file.content.subarray(0, SIGNATURE_SEARCH_WINDOW);
  if (header.indexOf(PDF_SIGNATURE) === -1) {
    throw new AppError('INVALID_FILE', 'El archivo debe estar en formato PDF.');
  }
}

/** Keeps only a safe display name; the stored file is always named by its UUID. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'cv.pdf').slice(0, 255);
}
