/** Dedicated database for end-to-end tests (same server as docker-compose.yml). */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://techmatch:techmatch@localhost:5434/techmatch_e2e';
