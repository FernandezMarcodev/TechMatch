import type { RequestHandler } from 'express';
import { AppError } from '../application/errors.js';

export interface RateLimitOptions {
  /** Requests allowed per client IP within one window. */
  max: number;
  windowMs: number;
  /** Spanish message for the 429 response. */
  message?: string;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface Window {
  startedAt: number;
  count: number;
}

/**
 * Fixed-window limiter kept in memory: each IP gets `max` requests per `windowMs`; the next
 * one is answered with RATE_LIMITED (429) until its window ends. Enough for a single API
 * instance; with several instances the counters would have to move to a shared store.
 */
export function createRateLimit({
  max,
  windowMs,
  now = Date.now,
  message = 'Subiste demasiados CVs en poco tiempo. Probá de nuevo en unos minutos.',
}: RateLimitOptions): RequestHandler {
  const windows = new Map<string, Window>();
  let lastSweep = now();

  return (req, res, next) => {
    const time = now();
    // Forget finished windows from time to time so the map does not grow forever.
    if (time - lastSweep >= windowMs) {
      for (const [ip, w] of windows) if (time - w.startedAt >= windowMs) windows.delete(ip);
      lastSweep = time;
    }

    const ip = req.ip ?? 'unknown';
    let current = windows.get(ip);
    if (!current || time - current.startedAt >= windowMs) {
      current = { startedAt: time, count: 0 };
      windows.set(ip, current);
    }
    current.count += 1;
    if (current.count <= max) {
      next();
      return;
    }

    const retryAfterSeconds = Math.ceil((current.startedAt + windowMs - time) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    throw new AppError('RATE_LIMITED', message, { retryAfterSeconds });
  };
}
