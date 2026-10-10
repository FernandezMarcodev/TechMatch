import path from 'node:path';
import express, { type Express, type Router } from 'express';
import type { Logger } from '../infrastructure/logging/logger.js';
import { createErrorHandler, notFoundHandler } from './error-handler.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigin: string;
  routes?: Router;
  /**
   * Built frontend (frontend/dist). When set, the API also serves the web app, so a single
   * free web service hosts everything on one origin (docs/16-DESPLIEGUE.md).
   */
  frontendDir?: string;
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

  if (deps.frontendDir) {
    const root = path.resolve(deps.frontendDir);
    app.use(express.static(root, { index: false, maxAge: '1h' }));
    // Single-page app: any other GET renders index.html and the client router takes over.
    // (/api requests never get here: the API's not-found handler above answers them.)
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.sendFile(path.join(root, 'index.html'));
    });
  }

  app.use(createErrorHandler(deps.logger));
  return app;
}
