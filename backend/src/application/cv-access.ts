import type { Cv } from '../domain/entities.js';
import { AppError } from './errors.js';
import type { CvRepository } from './ports.js';

/**
 * Who can see a CV: one saved in an account, only its owner; an unsaved one, whoever has its
 * link (its id is a random UUID). Anyone else gets "not found", which does not reveal that
 * the CV exists. Every use case that receives a CV id goes through here.
 */
export async function findVisibleCv(
  cvs: CvRepository,
  cvId: string,
  viewerId: string | null,
): Promise<Cv> {
  const cv = await cvs.findById(cvId);
  if (!cv || (cv.userId !== null && cv.userId !== viewerId)) {
    throw new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
  }
  return cv;
}
