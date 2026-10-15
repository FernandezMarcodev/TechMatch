# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TechMatch: anonymous web app. User uploads a CV (PDF) → structured `CandidateProfile` → deterministic matching against job offers synced from source APIs (the Get on Board public API plus the public job board APIs of companies on Lever and Greenhouse — no scraping; see `docs/05-FUENTES-DE-OFERTAS.md`) → only MEDIUM/HIGH recommendations, sorted by score, each with explanations. Specs (Spanish) live in `docs/` and are the functional source of truth; `docs/13-DECISIONES-TECNICAS.md` explains the non-obvious design decisions and their rationale — read it before changing matching, schema or job-source behavior. `docs/08-Claude.md` holds the agent rules (summarized here). `docs/14-PLAN-DE-DESARROLLO.md` is the version/branch plan after the MVP (`v1.0.0`). Deployment (free tier): `docs/16-DESPLIEGUE.md` — frontend on Cloudflare Pages (built with `VITE_API_URL` = the API URL), API on a Render web service created manually (`render.yaml` records its settings; `CORS_ORIGIN` lists the allowed frontend origins, comma-separated), Neon PostgreSQL, and `.github/workflows/sync-jobs.yml` syncs offers every 12 h straight against Neon; Render deploys `main` only after CI passes. The API can still serve `frontend/dist` itself when `FRONTEND_DIST_DIR` is set.

## Commands

npm workspaces: `backend/` (Node + strict TS, Express 5, ESM/NodeNext — relative imports need `.js` extensions) and `frontend/` (React 19 + Vite). Run from the repo root unless noted.

```bash
npm install
npm run db:up                      # Docker: Postgres 16 on localhost:5434 (also creates techmatch_test) + Mailpit (SMTP :1025, inbox UI http://localhost:8025)
cp backend/.env.example backend/.env
npm run migrate -w backend         # apply SQL migrations (backend/migrations, node-pg-migrate)
npm run dev:backend                # API on :3000 (tsx watch)
npm run dev:frontend               # Vite on :5173, proxies /api → :3000 (override with API_PROXY_TARGET)
npm run sync-jobs -w backend       # one sync of all job sources (real data); `-- --schedule` for the 12h scheduler
npm run send-test-email -w backend -- you@example.com  # check the email setup (Mailpit locally, Brevo with EMAIL_PROVIDER=brevo)

npm run typecheck                  # both workspaces
npm run lint                       # ESLint (flat config at root)
npm run format                     # Prettier
npm test                           # backend unit + integration, then frontend
npm run test:e2e                   # Playwright: own backend :3199 + frontend :5199, DB techmatch_e2e
```

Single tests:

```bash
cd backend && npx vitest run --project unit src/matching          # unit project (src/**/*.test.ts, no DB)
cd backend && npx vitest run --project unit src/matching/golden-cases.test.ts  # reference CV+offer cases (expected levels)
cd backend && npx vitest run --project integration test/api.test.ts  # needs DB; migrates TEST_DATABASE_URL first
cd backend && npx vitest run -t "remote job"                       # by test name
cd frontend && npx vitest run src/App.test.tsx
npx playwright test e2e/primary-flow.spec.ts
```

Integration tests share one database and run sequentially; they `TRUNCATE` all tables (see `backend/test/helpers.ts`). Test PDFs are generated in code by `backend/test/support/make-pdf.ts` (no binary fixtures).

## Architecture (backend/src)

Dependency direction: `api` → `application` → `domain`/`matching`; infrastructure (`persistence`, `infrastructure`, `cv-processing`, `job-sources`) implements ports defined in `application/ports.ts`. `main/container.ts` is the composition root; `main/server.ts`, `main/sync-jobs.ts`, `main/migrate.ts` are entry points (`main/job-sync.ts` wires connectors).

- `domain/` — entities, enums and **shared normalization** (`normalization/`: skill alias catalog + text skill extraction, languages/CEFR, Argentine provinces + other countries as regions, seniority and education keywords). CV processing, the job-source normalizer and matching all reuse these; never duplicate normalization elsewhere.
- `matching/` — pure engine `evaluateMatch(profile, job, config) → MatchEvaluation` (no ids/timestamps, fully deterministic). One evaluator per criterion in `criteria/`; each returns `{score|null, status, message}` and the reason text **is** that message, so explanations always derive from the calculation. `null` = UNKNOWN → excluded, weight redistributed. Weights/thresholds/sub-scores only in `matching-config.ts` (zod-validated; overridable via `MATCHING_CONFIG_PATH`). `requiredCriteria: ['skills']` forces LOW when skills can't be compared; `criterionMinimums: { skills: 40, seniority: 50, modality: 50 }` forces LOW below 40% technology match, for a seniority two or more levels away, or for onsite/hybrid offers in another region/country (rationale in the decisions doc); Only catalog skills are compared (`isCatalogSkill`: CVs are read with the catalog, so generic source tags would always be "missing"). `highMinimums: { skills: 60 }` caps at MEDIUM an offer whose score reaches HIGH while most technologies are missing. Weights follow the priority technologies > seniority > experience > rest; criteria (and reasons) are ordered that way in `CRITERIA`.
- `application/` — use cases: `CvService` (validate → store → async process via `TaskRunner` → profile → `MatchingService` computes results against active offers → status), `QueryService`, `AuthService` (optional accounts, `docs/17-CUENTAS-DE-USUARIO.md`: scrypt password hashes via `infrastructure/security`, random session tokens sent as `Authorization: Bearer` and stored only as SHA-256 — no cookies, frontend and API are on different domains; login requires a verified email; email verification and password reset use single-use `email_tokens` links (by purpose) sent through `EmailSender` and consumed atomically; a reset closes every session), `StatsService` (public trends dashboard, `docs/18-PANEL-DE-TENDENCIAS.md`: SQL aggregations in `persistence/pg-offer-stats-repository.ts` behind the `OfferStatsRepository` port, cached `STATS_CACHE_MINUTES`; no user/CV data; it also implements the `SkillDemand` port that `QueryService.getMissingSkills` uses for "Qué te falta"), `AppError` with the contract's error codes.
- `cv-processing/` — content-based PDF validation, `unpdf` text extraction rebuilt into lines (PDF y-axis is bottom-up), cleanup, section segmentation, conservative heuristic extraction (`profile-extractor.ts`). OCR is a disabled `OcrProvider` port; compression is a documented no-op.
- `job-sources/` — `JobSourceConnector` per source (`connectors/getonboard.ts`, with a pure `mapGetOnBoardJob`; `connectors/ats.ts`: Lever and Greenhouse company boards from `LEVER_COMPANIES`/`GREENHOUSE_COMPANIES` (`slug:Nombre`), pure mappers, only tech roles that are remote or in Argentina via `isRelevantOffer`/`isArgentineLocation`, a missing board (404) is skipped) → `RawJobOffer` → `normalizer.ts` (section-aware required vs nice-to-have skills; experience/education/languages read only from requirement lines when present) → `deduplicator.ts` → `JobOfferRepository.upsert` (dedup priority externalId → URL → source+title+company+location). `JobSyncService` runs sources independently; failed/empty syncs never deactivate offers; after a sync where any source succeeded, `syncAndRecalculate` (`main/job-sync.ts`) runs `CvService.recalculateAll()` so every processed CV is matched again against the active offers. `HttpClient` treats 401/403/429 as `SourceUnavailableError` — never retried or evaded. Adding a source = new connector + value in `JOB_SOURCES`.
- `infrastructure/email/` — `EmailSender` port implementations chosen by `EMAIL_PROVIDER`: `SmtpEmailSender` (Nodemailer → Mailpit in dev), `BrevoEmailSender` (Brevo HTTP API in production: Render free blocks SMTP ports), `MemoryEmailSender` (tests).
- `persistence/` — raw SQL repositories over `pg` (NUMERIC comes back as string → `toNumber`); requirements stored as newline-separated TEXT.
- `api/` — routes (`auth-routes.ts` for `/api/auth`, with `requireUser` for endpoints that need a session) + DTO mappers (`dto.ts`): lowercase CV statuses, `{data: …}` / `{error: {code, message, details}}`, never expose entities or storage paths. Malformed UUIDs → 404 of the resource.

Frontend (`frontend/src`): Material Design 3 look — color/shape/elevation tokens in `styles/tokens.css` (light theme only — no dark mode, by decision), components in `styles/app.css`, inline SVG icons in `components/Icon.tsx` (no icon/UI library). `api/client.ts` (typed fetch, `ApiError`, session token in `localStorage` sent as `Authorization: Bearer`); `auth/AuthContext.tsx` (`useAuth`) + `components/RequireAuth.tsx` for optional accounts (`/crear-cuenta`, `/ingresar`, `/cuenta`, `/verificar-email`, `/olvide-contrasena`, `/restablecer`); account e2e reads the real email from Mailpit (`e2e/mailpit.ts`); the front page `/` is the login screen (`components/AuthLayout.tsx`: form + account perks, "Continuar sin cuenta"; logged-in users go to `/analizar`); pages Home at `/analizar` (hero + drag & drop upload) → Processing (polls status) → Recommendations ("Qué te falta" card `components/MissingSkills.tsx`, signal-bar level meter — the numeric score is internal and never sent by the API —, client-side level/remote filters, expandable reasons, "show more") → Job detail; `/tendencias` (public dashboard: tiles + CSS charts in `components/Charts.tsx` — rankings, conic-gradient rings, columns, stacked bar —, no chart library; chart palette `--chart-*` in `tokens.css`, category colors in `components/labels.ts`; skill areas come from `area` in the skill catalog). UI text is Spanish.

## Git workflow

One branch per ticket from the plan (`feat/…`, `fix/…`, `chore/…`, `docs/…`), created from `main`; Conventional Commits; each branch ships code + tests + docs. When a ticket is done and `npm run ci` passes locally: push the branch, then merge it **directly** into `main` with `git merge --no-ff` and push `main` — **no Pull Requests** unless the user asks for one. Keep the branch on GitHub after merging. CI runs on every push to `main`. One annotated tag per version (`vX.Y.Z`) on `main`.

## Rules that must hold

- Scope: the MVP plus only what `docs/14-PLAN-DE-DESARROLLO.md` assigns to the current ticket/branch. Accounts are optional but privileged (`docs/17-CUENTAS-DE-USUARIO.md` § Privilegios): anonymous users can upload a CV and see the first recommendations; all recommendations, CV adaptation and saved CVs require a session — enforced in the API, not only hidden in the UI. Saving a CV is opt-in ("Guardar en mi cuenta"); a saved CV (`cvs.user_id`) answers 404 to anyone but its owner — every use case resolves CVs through `application/cv-access.ts` (`findVisibleCv`); unsaved CVs expire via `purge-cvs`. Never auto-apply to jobs, never use an LLM for scoring, and an adapted CV never adds data the CV doesn't contain (missing items are suggestions only).
- Never invent candidate data: unknown → `null`/`UNKNOWN`/empty. UNKNOWN is neither match nor mismatch.
- LOW and inactive offers are never recommended; order is score DESC.
- Never log CV contents (pino redacts `*.text`/`*.extractedText`; log metadata only). Uploaded files are private, named `<uuid>.pdf`.
- No hardcoded weights, thresholds, intervals, limits or source URLs — use `config/env.ts` (zod) or matching config.
- No scraping: only sources offering an interface for automated access (API/feed). Never bypass blocks, CAPTCHAs or access controls (the big regional job boards block bots — see decisions doc).
- User-facing strings (errors, match reasons, UI) are Spanish.
- Decision priority: explicit requirement → API/data contract → architecture spec → existing conventions → simplest option.
