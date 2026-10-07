# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TechMatch: anonymous web app. User uploads a CV (PDF) → structured `CandidateProfile` → deterministic matching against job offers synced from source APIs (the Get on Board public API — no scraping; see `docs/05-FUENTES-DE-OFERTAS.md`) → only MEDIUM/HIGH recommendations, sorted by score, each with explanations. Specs (Spanish) live in `docs/` and are the functional source of truth; `docs/13-DECISIONES-TECNICAS.md` explains the non-obvious design decisions and their rationale — read it before changing matching, schema or job-source behavior. `docs/08-Claude.md` holds the agent rules (summarized here).

## Commands

npm workspaces: `backend/` (Node + strict TS, Express 5, ESM/NodeNext — relative imports need `.js` extensions) and `frontend/` (React 19 + Vite). Run from the repo root unless noted.

```bash
npm install
npm run db:up                      # Postgres 16 in Docker on localhost:5434 (also creates techmatch_test)
cp backend/.env.example backend/.env
npm run migrate -w backend         # apply SQL migrations (backend/migrations, node-pg-migrate)
npm run dev:backend                # API on :3000 (tsx watch)
npm run dev:frontend               # Vite on :5173, proxies /api → :3000 (override with API_PROXY_TARGET)
npm run sync-jobs -w backend       # one sync of all job sources (real data); `-- --schedule` for the 12h scheduler

npm run typecheck                  # both workspaces
npm run lint                       # ESLint (flat config at root)
npm run format                     # Prettier
npm test                           # backend unit + integration, then frontend
npm run test:e2e                   # Playwright: starts backend :3100 + frontend :5174, DB techmatch_e2e
```

Single tests:

```bash
cd backend && npx vitest run --project unit src/matching          # unit project (src/**/*.test.ts, no DB)
cd backend && npx vitest run --project integration test/api.test.ts  # needs DB; migrates TEST_DATABASE_URL first
cd backend && npx vitest run -t "remote job"                       # by test name
cd frontend && npx vitest run src/App.test.tsx
npx playwright test e2e/primary-flow.spec.ts
```

Integration tests share one database and run sequentially; they `TRUNCATE` all tables (see `backend/test/helpers.ts`). Test PDFs are generated in code by `backend/test/support/make-pdf.ts` (no binary fixtures).

## Architecture (backend/src)

Dependency direction: `api` → `application` → `domain`/`matching`; infrastructure (`persistence`, `infrastructure`, `cv-processing`, `job-sources`) implements ports defined in `application/ports.ts`. `main/container.ts` is the composition root; `main/server.ts`, `main/sync-jobs.ts`, `main/migrate.ts` are entry points (`main/job-sync.ts` wires connectors).

- `domain/` — entities, enums and **shared normalization** (`normalization/`: skill alias catalog + text skill extraction, languages/CEFR, Argentine provinces + other countries as regions, seniority and education keywords). CV processing, the job-source normalizer and matching all reuse these; never duplicate normalization elsewhere.
- `matching/` — pure engine `evaluateMatch(profile, job, config) → MatchEvaluation` (no ids/timestamps, fully deterministic). One evaluator per criterion in `criteria/`; each returns `{score|null, status, message}` and the reason text **is** that message, so explanations always derive from the calculation. `null` = UNKNOWN → excluded, weight redistributed. Weights/thresholds/sub-scores only in `matching-config.ts` (zod-validated; overridable via `MATCHING_CONFIG_PATH`). `requiredCriteria: ['skills']` forces LOW when skills can't be compared; `criterionMinimums: { skills: 40, modality: 50 }` forces LOW below 40% technology match or for onsite/hybrid offers in another region/country (rationale in the decisions doc). Weights follow the priority technologies > seniority > experience > rest; criteria (and reasons) are ordered that way in `CRITERIA`.
- `application/` — use cases: `CvService` (validate → store → async process via `TaskRunner` → profile → `MatchingService` computes results against active offers → status), `QueryService`, `AppError` with the contract's error codes.
- `cv-processing/` — content-based PDF validation, `unpdf` text extraction rebuilt into lines (PDF y-axis is bottom-up), cleanup, section segmentation, conservative heuristic extraction (`profile-extractor.ts`). OCR is a disabled `OcrProvider` port; compression is a documented no-op.
- `job-sources/` — `JobSourceConnector` per source (`connectors/getonboard.ts`, with a pure `mapGetOnBoardJob`) → `RawJobOffer` → `normalizer.ts` (section-aware required vs nice-to-have skills; experience/education/languages read only from requirement lines when present) → `deduplicator.ts` → `JobOfferRepository.upsert` (dedup priority externalId → URL → source+title+company+location). `JobSyncService` runs sources independently; failed/empty syncs never deactivate offers. `HttpClient` treats 401/403/429 as `SourceUnavailableError` — never retried or evaded. Adding a source = new connector + value in `JOB_SOURCES`.
- `persistence/` — raw SQL repositories over `pg` (NUMERIC comes back as string → `toNumber`); requirements stored as newline-separated TEXT.
- `api/` — routes + DTO mappers (`dto.ts`): lowercase CV statuses, `{data: …}` / `{error: {code, message, details}}`, never expose entities or storage paths. Malformed UUIDs → 404 of the resource.

Frontend (`frontend/src`): Material Design 3 look — color/shape/elevation tokens in `styles/tokens.css` (light + dark via `prefers-color-scheme`), components in `styles/app.css`, inline SVG icons in `components/Icon.tsx` (no icon/UI library). `api/client.ts` (typed fetch, `ApiError`); pages Home (hero + drag & drop upload) → Processing (polls status) → Recommendations (signal-bar level meter — the numeric score is internal and never sent by the API —, client-side level/remote filters, expandable reasons, "show more") → Job detail. UI text is Spanish.

## Rules that must hold

- MVP scope only: no auth/registration/sessions/profiles/visible history, no auto-apply, no CV generation/adaptation, no LLM in scoring (`docs/12-FUTURE-ROADMAP.md` is out of scope).
- Never invent candidate data: unknown → `null`/`UNKNOWN`/empty. UNKNOWN is neither match nor mismatch.
- LOW and inactive offers are never recommended; order is score DESC.
- Never log CV contents (pino redacts `*.text`/`*.extractedText`; log metadata only). Uploaded files are private, named `<uuid>.pdf`.
- No hardcoded weights, thresholds, intervals, limits or source URLs — use `config/env.ts` (zod) or matching config.
- No scraping: only sources offering an interface for automated access (API/feed). Never bypass blocks, CAPTCHAs or access controls (the big regional job boards block bots — see decisions doc).
- User-facing strings (errors, match reasons, UI) are Spanish.
- Decision priority: explicit requirement → API/data contract → architecture spec → existing conventions → simplest option.
