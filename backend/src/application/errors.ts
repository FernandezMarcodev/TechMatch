export const ERROR_CODES = [
  'INVALID_FILE',
  'FILE_TOO_LARGE',
  'PDF_NOT_PROCESSABLE',
  'CV_PROCESSING_FAILED',
  'CV_NOT_FOUND',
  'JOB_NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Expected, user-facing failure. Messages are Spanish because they reach the UI. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
