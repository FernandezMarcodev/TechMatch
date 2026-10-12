import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const commaList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  )
  .or(z.array(z.string()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * Express `trust proxy`: `true` (use the first X-Forwarded-For address), a number of proxy
   * hops, or `false` when the API is reached directly.
   */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) => (value === 'true' ? true : value === 'false' ? false : Number(value)))
    .pipe(z.union([z.boolean(), z.number().int().min(0)])),
  /** Built frontend served by the API (single-service deployment); unset in development. */
  FRONTEND_DIST_DIR: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),

  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),

  CV_MAX_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  CV_STORAGE_DIR: z.string().min(1).default('./storage/cvs'),
  /** Below this many letters/digits the PDF is treated as having no usable text. */
  CV_MIN_TEXT_CHARS: z.coerce.number().int().positive().default(50),
  /** Days a CV (and its profile and results) is kept before `npm run purge-cvs` deletes it. */
  CV_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  /** Days a login session lasts. */
  SESSION_TTL_DAYS: z.coerce.number().positive().default(30),
  /** Register/login attempts allowed per client IP within each window. */
  AUTH_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  /** CV uploads allowed per client IP within each window. */
  CV_UPLOAD_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  CV_UPLOAD_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),

  MATCHING_CONFIG_PATH: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),

  // Job offers synchronization from source APIs (docs/05-FUENTES-DE-OFERTAS.md)
  JOB_SYNC_ENABLED: booleanString.default(false),
  JOB_SYNC_RUN_ON_START: booleanString.default(false),
  JOB_SYNC_INTERVAL_HOURS: z.coerce.number().positive().default(12),
  JOB_SYNC_MAX_OFFERS_PER_SOURCE: z.coerce.number().int().positive().default(300),
  HTTP_USER_AGENT: z.string().min(1).default('TechMatchBot/0.1'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  HTTP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  HTTP_REQUEST_DELAY_MS: z.coerce.number().int().min(0).default(1_000),
  HTTP_BACKOFF_BASE_MS: z.coerce.number().int().min(0).default(2_000),

  GETONBOARD_ENABLED: booleanString.default(true),
  GETONBOARD_API_URL: z.url().default('https://www.getonbrd.com/api/v0'),
  GETONBOARD_CATEGORIES: commaList.default([
    'programming',
    'data-science-analytics',
    'sysadmin-devops-qa',
    'mobile-developer',
    'machine-learning-ai',
    'cybersecurity',
  ]),
  GETONBOARD_PER_PAGE: z.coerce.number().int().min(1).max(100).default(50),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the process environment.
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

export function getEnv(): Env {
  if (!cached) {
    loadDotEnv();
    cached = loadEnv();
  }
  return cached;
}
