import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          // Integration tests share one database, so run files sequentially.
          fileParallelism: false,
        },
      },
    ],
  },
});
