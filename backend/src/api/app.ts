import express, { type Express, type Router } from 'express';
import type { Logger } from '../infrastructure/logging/logger.js';
import { createErrorHandler, notFoundHandler } from './error-handler.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigin: string;
  routes?: Router;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', deps.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ data: { status: 'ok' } });
  });
  if (deps.routes) app.use('/api', deps.routes);

  app.use('/api', notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
}
