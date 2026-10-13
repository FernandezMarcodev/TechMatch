import type { CvProcessor } from '../cv-processing/cv-processor.js';
import {
  sanitizeFilename,
  validatePdfUpload,
  type UploadedFile,
} from '../cv-processing/pdf-validation.js';
import type { TextExtractor } from '../cv-processing/text-extraction.js';
import type { Cv, SavedCv } from '../domain/entities.js';
import type { CvStatus } from '../domain/enums.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import { findVisibleCv } from './cv-access.js';
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
      processingStatus: 'UPLOADED',
      // Unsaved until the user chooses "Guardar en mi cuenta".
      userId: null,
      savedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await cvs.create(cv);
    // Mark as processing before responding so the client sees a consistent state.
    await cvs.updateStatus(id, 'PROCESSING');
    runner.run('process-cv', () => this.process(id));
    return { cvId: id, status: 'PROCESSING' };
  }

  /**
   * Processing runs in memory: a restart loses in-flight work, which would leave those CVs
   * "processing" forever. Called once at startup (single backend instance), it fails them
   * so the user is told to upload the CV again.
   */
  async recoverInterrupted(): Promise<number> {
    const count = await this.deps.cvs.failInterrupted();
    if (count > 0) {
      this.deps.logger.warn({ count }, 'CVs interrupted by a restart marked as failed');
    }
    return count;
  }

  /**
   * Personal data is kept only for a while: CVs older than `retentionDays` are deleted with
   * their profile and results (docs/13-DECISIONES-TECNICAS.md). Run by `npm run purge-cvs`.
   */
  async purgeExpired(retentionDays: number): Promise<number> {
    const cutoff = new Date(this.deps.clock.now().getTime() - retentionDays * 86_400_000);
    const count = await this.deps.cvs.deleteCreatedBefore(cutoff);
    this.deps.logger.info({ count, retentionDays }, 'Expired CVs deleted');
    return count;
  }

  async getStatus(cvId: string, viewerId: string | null): Promise<CvStatus> {
    const cv = await findVisibleCv(this.deps.cvs, cvId, viewerId);
    return cv.processingStatus;
  }

  /**
   * "Guardar en mi cuenta": the user chooses to keep the analysis. Saved CVs belong to the
   * account (only the owner sees them) and no longer expire after CV_RETENTION_DAYS.
   */
  async saveToAccount(cvId: string, userId: string): Promise<void> {
    const { cvs, clock, logger } = this.deps;
    const cv = await findVisibleCv(cvs, cvId, userId);
    if (cv.processingStatus !== 'PROCESSED') {
      throw new AppError(
        'CV_NOT_PROCESSED',
        'El CV todavía no terminó de procesarse o no se pudo procesar.',
      );
    }
    if (cv.userId === userId) return;
    await cvs.saveForUser(cvId, userId, clock.now());
    logger.info({ cvId, userId }, 'CV saved in account');
  }

  listSaved(userId: string): Promise<SavedCv[]> {
    return this.deps.cvs.findSavedByUser(userId);
  }

  /** Deletes a saved CV right away, with its profile and results. Only its owner can. */
  async deleteSaved(cvId: string, userId: string): Promise<void> {
    const cv = await findVisibleCv(this.deps.cvs, cvId, userId);
    if (cv.userId !== userId)
      throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
    await this.deps.cvs.delete(cvId);
    this.deps.logger.info({ cvId, userId }, 'Saved CV deleted');
  }

  async process(cvId: string): Promise<void> {
    const { cvs, profiles, storage, processor, matching, clock, ids, logger } = this.deps;
    const cv = await cvs.findById(cvId);
    if (!cv) return;
    const startedAt = Date.now();
    try {
      const content = await storage.read(cv.storagePath);
      // The extracted text only feeds the profile: like the PDF, it is not stored.
      const { profile } = await processor.process(content, clock.now());
      const fullProfile = { ...profile, id: ids.next(), cvId };
      await profiles.save(fullProfile);
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
    } finally {
      // The PDF is only needed to extract the text: once processed (or failed) it is deleted.
      await storage.delete(cv.storagePath).catch((err: unknown) => {
        logger.warn({ cvId, err }, 'Could not delete the CV file');
      });
    }
  }
}
