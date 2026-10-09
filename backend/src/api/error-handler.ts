import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError, type ErrorCode } from '../application/errors.js';
import type { Logger } from '../infrastructure/logging/logger.js';

const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_FILE: 400,
  FILE_TOO_LARGE: 413,
  PDF_NOT_PROCESSABLE: 422,
  CV_PROCESSING_FAILED: 422,
  CV_NOT_FOUND: 404,
  JOB_NOT_FOUND: 404,
  CV_NOT_PROCESSED: 409,
  INVALID_CV_DOCUMENT: 400,
  INTERNAL_ERROR: 500,
};

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details: Record<string, unknown> };
}

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new AppError('FILE_TOO_LARGE', 'El archivo supera el tamaño máximo permitido.');
    }
    return new AppError('INVALID_FILE', 'Debe enviarse un único archivo PDF en el campo "file".');
  }
  return undefined;
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    const appError = toAppError(err);
    if (appError) {
      const body: ErrorBody = {
        error: { code: appError.code, message: appError.message, details: appError.details },
      };
      res.status(HTTP_STATUS[appError.code]).json(body);
      return;
    }
    logger.error({ err }, 'Unhandled error');
    const body: ErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.', details: {} },
    };
    res.status(500).json(body);
  };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'INTERNAL_ERROR', message: 'Recurso no encontrado.', details: {} },
  });
};
