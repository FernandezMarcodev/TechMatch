import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://techmatch:techmatch@localhost:5434/techmatch_e2e';
const BACKEND_PORT = 3100;
const FRONTEND_PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
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
      command: 'npx tsx src/main/server.ts',
      cwd: 'backend',
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        CV_STORAGE_DIR: path.join(os.tmpdir(), 'techmatch-e2e-cvs'),
        SCRAPING_ENABLED: 'false',
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
