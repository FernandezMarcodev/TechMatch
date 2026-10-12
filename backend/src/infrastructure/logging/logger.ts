import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string): Logger {
  return pino({
    level,
    // CV contents and credentials must never reach logs; redact the obvious carriers.
    redact: [
      '*.extractedText',
      '*.text',
      '*.password',
      '*.passwordHash',
      '*.token',
      'req.headers.cookie',
      'req.headers.authorization',
    ],
  });
}
