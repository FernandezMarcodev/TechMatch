# TechMatch — Instructions for Claude Code

## Project

TechMatch is a web application that:

1. receives a CV as PDF;
2. extracts its text;
3. builds a structured candidate profile;
4. syncs tech job offers from the Get on Board public API and from the public job board APIs of companies on Lever and Greenhouse;
5. stores normalized job offers;
6. calculates deterministic CV/job matching (recalculated after every sync);
7. shows only MEDIUM and HIGH recommendations;
8. explains the matching result;
9. adapts the CV to an offer without inventing data (`docs/15-ADAPTACION-DE-CV.md`);
10. offers optional accounts with privileges (`docs/17-CUENTAS-DE-USUARIO.md`);
11. shows a public trends dashboard and "Qué te falta" (`docs/18-PANEL-DE-TENDENCIAS.md`).

## Scope constraints

The current scope is the one `docs/14-PLAN-DE-DESARROLLO.md` assigns to each version and branch. Accounts are optional but privileged: anonymous users can upload a CV and see the first recommendations; all recommendations, CV adaptation and saved CVs require a session, enforced in the API.

Do NOT implement:

* automatic job applications;
* an LLM or generative AI to score or rank;
* adding to an adapted CV data the CV does not contain (missing items are suggestions only);
* web scraping;
* features not assigned in the plan (login with Google, admin roles, OCR, company features — see `docs/12-FUTURE-ROADMAP.md`).

## Stack

Frontend:

```text
React + TypeScript + Vite
Material Design 3 (own tokens and components, no UI library)
```

Backend:

```text
Node.js + TypeScript (strict, ESM)
Express 5
PostgreSQL + pg (raw SQL repositories) + node-pg-migrate
Vitest, Testing Library, Playwright
```

## Before coding

Always:

1. inspect the repository;
2. read `CLAUDE.md` and this file;
3. read `docs/01-SRS-IEEE-29148.md` and the version in `docs/14-PLAN-DE-DESARROLLO.md`;
4. read the relevant specification;
5. read `docs/13-DECISIONES-TECNICAS.md` before changing matching, schema or job sources;
6. understand existing code before changing it;
7. avoid introducing dependencies without justification.

## Architecture

Keep these concerns separated:

```text
API
Application
Domain
Infrastructure (email, security, storage)
Job sources
CV Processing
CV Adaptation
Matching
Persistence
```

Business logic must not live inside React components or HTTP controllers.

## Matching

The matching engine MUST be deterministic.

Do not use an LLM or generative AI to decide the final score.

The engine receives:

```text
CandidateProfile
JobOffer
MatchingConfig
```

and returns:

```text
MatchEvaluation (score, level, criteria, reasons)
```

Reasons have a status: `positive`, `partial` (met in part), `negative` or `neutral` (not required or not comparable). Only catalog skills are compared.

For identical input and configuration, output must be identical.

The engine must be independently unit-testable.

## Missing information

Never invent candidate information.

UNKNOWN is not automatically YES or NO.

## Explanations

Every recommendation must have explanations generated from actual matching criteria.

Do not fabricate explanations after calculating the score.

## Job sources

Implement each source as an independent connector to an interface the source offers for automated access (public API or feed):

```text
JobSourceConnector
├── GetOnBoardConnector
└── AtsConnector         (createLeverConnector / createGreenhouseConnector:
                          one company board per entry of LEVER_COMPANIES / GREENHOUSE_COMPANIES)
```

One source failing must not stop the others.

Do not scrape web pages. Do not implement CAPTCHA bypassing, access-control bypasses or anti-bot evasion. Treat 401/403/429 as "source unavailable" and do not retry.

## PDF

Accept PDF only.

Validate the file by content.

Apply a configurable size limit.

Extract text.

Use OCR only when necessary and supported.

Never expose uploaded CVs publicly.

Do not log full CV content. Delete the PDF after processing and do not store the extracted text.

## API

Follow `docs/04-API-CONTRACTS.md`.

Do not expose database entities directly.

Use DTOs.

Use the standardized error shape.

## Database

Follow `docs/07-DATABASE.md`.

Use repositories/data-access abstractions so domain logic is not tied directly to SQL.

## User interface

Follow Material Design 3: color roles, shape, elevation and type scale from `frontend/src/styles/tokens.css`.

Light theme only (no dark mode), mobile and desktop, keyboard focus and reduced motion.

All user-facing text is Spanish.

## Configuration

Do not hardcode:

* matching weights;
* thresholds and minimums;
* sync interval;
* file limits;
* source URLs, categories and company lists;
* rate limits, retention days and list sizes;
* secrets.

Use environment variables or configuration.

## Testing

Required:

* unit tests for matching;
* unit tests for normalization;
* connector mapping tests;
* API integration tests;
* persistence integration tests;
* CV processing tests where practical;
* reference CV + offer cases (`golden-cases.test.ts`);
* account, privilege and saved-CV tests (the API enforces them);
* frontend component tests;
* end-to-end tests for the primary flow, accounts (real emails through Mailpit) and saved CVs.

Important matching cases:

* perfect match;
* high match;
* medium match;
* low match;
* missing information;
* aliases;
* required vs nice-to-have skills;
* technology match below the minimum;
* different seniority;
* more experience;
* less experience;
* remote job;
* incompatible modality;
* missing language;
* missing education.

## Security

Validate uploaded files.

Do not trust client-provided MIME type alone.

Prevent path traversal.

Limit upload size.

Do not expose storage paths.

Do not put secrets in source code.

Do not log personal CV contents, passwords or tokens.

Store passwords (scrypt) and tokens (SHA-256) only as hashes.

Resolve every CV through `application/cv-access.ts`: a saved CV answers 404 to anyone but its owner.

## Code quality

Prefer:

* small functions;
* explicit names;
* strict types;
* dependency inversion;
* pure functions for business rules;
* clear interfaces;
* tests.

Avoid:

* `any`;
* giant controllers;
* business logic in UI;
* duplicated matching or normalization logic;
* direct database calls from React;
* hardcoded magic numbers;
* unnecessary abstractions.

## Definition of Done

A task is complete only when:

* implementation satisfies the requirement;
* relevant tests exist and pass;
* type checking and linting pass;
* errors are handled;
* contracts are respected;
* no existing functionality is unnecessarily broken;
* code follows project architecture.

## Priority

When making a decision, use this priority:

1. explicit requirement;
2. API/data contract;
3. architecture specification;
4. existing project conventions;
5. simplest reasonable implementation.

Do not add product features just because they seem useful.
