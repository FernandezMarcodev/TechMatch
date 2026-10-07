import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string): Logger {
  return pino({
    level,
    // CV contents must never reach logs; redact the obvious carriers defensively.
    redact: ['*.extractedText', '*.text', 'req.headers.cookie'],
  });
}
