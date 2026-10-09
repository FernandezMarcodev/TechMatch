import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/e2e-env';

// Uncommon ports so E2E can run while the dev servers (3000/5173) are up.
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 3199);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5199);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The database is prepared first: the backend queries it on startup.
      command: 'npx tsx ../e2e/prepare-db.ts && npx tsx src/main/server.ts',
      cwd: 'backend',
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        CV_STORAGE_DIR: path.join(os.tmpdir(), 'techmatch-e2e-cvs'),
        JOB_SYNC_ENABLED: 'false',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      cwd: 'frontend',
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
