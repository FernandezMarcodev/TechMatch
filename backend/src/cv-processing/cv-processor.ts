import { AppError } from '../application/errors.js';
import { extractProfile, type ExtractedProfile } from './profile-extractor.js';
import { cleanText, meaningfulLength } from './text-cleanup.js';
import type { OcrProvider, TextExtractor } from './text-extraction.js';

export interface CvProcessingResult {
  readonly text: string;
  readonly profile: ExtractedProfile;
}

/**
 * Pipeline from docs/06-CV-PROCESSING.md:
 * validation (at upload) → optimization → text extraction → OCR fallback → cleanup →
 * segmentation → structured extraction → normalization → profile.
 *
 * Optimization/compression (RF-004, optional) is a pass-through: files are small (size
 * limit) and stored privately, so re-encoding PDFs is not worth a new dependency yet.
 */
export class CvProcessor {
  constructor(
    private readonly extractor: TextExtractor,
    private readonly ocr: OcrProvider,
    private readonly minTextChars: number,
  ) {}

  async process(content: Buffer, referenceDate: Date): Promise<CvProcessingResult> {
    let text = cleanText(await this.extractor.extract(content));

    if (meaningfulLength(text) < this.minTextChars && this.ocr.enabled) {
      text = cleanText(await this.ocr.recognize(content));
    }
    if (meaningfulLength(text) < this.minTextChars) {
      throw new AppError(
        'PDF_NOT_PROCESSABLE',
        'El PDF no contiene texto legible. Si es un documento escaneado, probá con una versión exportada como texto.',
      );
    }
    return { text, profile: extractProfile(text, referenceDate) };
  }
}
