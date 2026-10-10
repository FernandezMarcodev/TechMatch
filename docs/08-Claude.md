# TechMatch — Instructions for Claude Code

## Project

TechMatch is a web application that:

1. receives a CV as PDF;
2. extracts its text;
3. builds a structured candidate profile;
4. syncs tech job offers from the Get on Board public API;
5. stores normalized job offers;
6. calculates deterministic CV/job matching;
7. shows only MEDIUM and HIGH recommendations;
8. explains the matching result.

## MVP constraints

The MVP is anonymous.

Do NOT implement:

* user registration;
* login;
* authentication;
* persistent sessions;
* user profiles;
* visible CV history;
* automatic job applications;
* CV generation;
* Harvard CV;
* automatic CV adaptation;
* web scraping.

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
3. read `docs/01-SRS-IEEE-29148.md`;
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
Infrastructure
Job sources
CV Processing
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
└── GetOnBoardConnector
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

Do not log full CV content.

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
* source URLs and categories;
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
* frontend component tests;
* end-to-end test for the primary flow.

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

Do not log personal CV contents.

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
