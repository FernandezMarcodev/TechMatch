import type { CvProcessor } from '../cv-processing/cv-processor.js';
import {
  sanitizeFilename,
  validatePdfUpload,
  type UploadedFile,
} from '../cv-processing/pdf-validation.js';
import type { TextExtractor } from '../cv-processing/text-extraction.js';
import type { Cv } from '../domain/entities.js';
import type { CvStatus } from '../domain/enums.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { AppError } from './errors.js';
import type { MatchingService } from './matching-service.js';
import type {
  CandidateProfileRepository,
  Clock,
  CvRepository,
  FileStorage,
  IdGenerator,
} from './ports.js';
import type { TaskRunner } from './task-runner.js';

export interface CvServiceDeps {
  readonly cvs: CvRepository;
  readonly profiles: CandidateProfileRepository;
  readonly storage: FileStorage;
  readonly extractor: TextExtractor;
  readonly processor: CvProcessor;
  readonly matching: MatchingService;
  readonly runner: TaskRunner;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly maxSizeBytes: number;
}

export class CvService {
  constructor(private readonly deps: CvServiceDeps) {}

  /** Validates and stores the PDF, then processes it in the background. */
  async upload(file: UploadedFile): Promise<{ cvId: string; status: CvStatus }> {
    const { cvs, storage, extractor, runner, clock, ids, maxSizeBytes } = this.deps;
    validatePdfUpload(file, maxSizeBytes);
    await extractor.assertReadable(file.content);

    const id = ids.next();
    const storagePath = await storage.save(id, file.content);
    const now = clock.now();
    const cv: Cv = {
      id,
      originalFilename: sanitizeFilename(file.originalName),
      storagePath,
      mimeType: 'application/pdf', // verified from content, not taken from the client
      sizeBytes: file.content.length,
      extractedText: null,
      processingStatus: 'UPLOADED',
      createdAt: now,
      updatedAt: now,
    };
    await cvs.create(cv);
    // Mark as processing before responding so the client sees a consistent state.
    await cvs.updateStatus(id, 'PROCESSING');
    runner.run('process-cv', () => this.process(id));
    return { cvId: id, status: 'PROCESSING' };
  }

  async getStatus(cvId: string): Promise<CvStatus> {
    const cv = await this.deps.cvs.findById(cvId);
    if (!cv) throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
    return cv.processingStatus;
  }

  async process(cvId: string): Promise<void> {
    const { cvs, profiles, storage, processor, matching, clock, ids, logger } = this.deps;
    const cv = await cvs.findById(cvId);
    if (!cv) return;
    const startedAt = Date.now();
    try {
      const content = await storage.read(cv.storagePath);
      const { text, profile } = await processor.process(content, clock.now());
      const fullProfile = { ...profile, id: ids.next(), cvId };
      await profiles.save(fullProfile);
      await cvs.updateStatus(cvId, 'PROCESSING', text);
      const results = await matching.computeForProfile(fullProfile);
      await cvs.updateStatus(cvId, 'PROCESSED');
      // Only metadata is logged: CV contents never reach the logs.
      logger.info(
        {
          cvId,
          durationMs: Date.now() - startedAt,
          skills: fullProfile.skills.length,
          matches: results.length,
          recommended: results.filter((r) => r.level !== 'LOW').length,
        },
        'CV processed',
      );
    } catch (err) {
      await cvs.updateStatus(cvId, 'FAILED');
      const code = err instanceof AppError ? err.code : 'CV_PROCESSING_FAILED';
      logger.warn(
        { cvId, code, err: err instanceof AppError ? undefined : err },
        'CV processing failed',
      );
    }
  }
}
