# TechMatch

[![CI](https://github.com/FernandezMarcodev/TechMatch/actions/workflows/ci.yml/badge.svg)](https://github.com/FernandezMarcodev/TechMatch/actions/workflows/ci.yml)

Aplicación web que analiza un CV en PDF y recomienda ofertas de trabajo en tecnología compatibles, explicando por qué encaja cada una.

- Matching **determinístico y explicable**: tecnologías, seniority, experiencia, educación, idiomas, ubicación y modalidad.
- Ofertas reales obtenidas de la **API pública de Get on Board** (sin scraping), actualizadas cada 12 horas.
- Interfaz en **Material Design 3**, responsive, con modo claro y oscuro.
- Uso anónimo: sin registro.

## Stack

| Capa     | Tecnologías                             |
| -------- | --------------------------------------- |
| Frontend | React 19, TypeScript, Vite              |
| Backend  | Node.js, TypeScript, Express 5          |
| Datos    | PostgreSQL 16 (Docker), migraciones SQL |
| Tests    | Vitest, Testing Library, Playwright     |
| CI       | GitHub Actions                          |

## Requisitos

- Node.js 22.12 o superior (recomendado 24).
- Docker Desktop (para PostgreSQL).

## Puesta en marcha local

```bash
npm install
npm run db:up                         # PostgreSQL en localhost:5434
cp backend/.env.example backend/.env
npm run migrate -w backend            # crea las tablas
npm run sync-jobs -w backend          # descarga ofertas reales de Get on Board
```

En dos terminales:

```bash
npm run dev:backend                   # API en http://localhost:3000
npm run dev:frontend                  # App en http://localhost:5173
```

Abrí <http://localhost:5173> y subí un CV en PDF.

## Tests y calidad

```bash
npm run lint             # ESLint
npm run format:check     # Prettier
npm run typecheck        # TypeScript
npm test                 # unitarios + integración (necesita la base levantada)
npm run test:e2e         # end-to-end con Playwright
npm run ci               # todo lo anterior + build, igual que GitHub Actions
```

La primera vez, Playwright necesita su navegador: `npx playwright install chromium`.

## Estructura

```text
backend/    API, procesamiento de CV, motor de matching, fuentes de ofertas
frontend/   aplicación React
e2e/        tests end-to-end
docs/       especificación (SRS, matching, API, base de datos, decisiones, plan)
```

## Documentación

La especificación completa está en [`docs/`](docs/). Puntos de entrada:

- [`01-SRS-IEEE-29148.md`](docs/01-SRS-IEEE-29148.md): requisitos.
- [`03-MATCHING-SPEC.md`](docs/03-MATCHING-SPEC.md): cómo se calcula la compatibilidad.
- [`13-DECISIONES-TECNICAS.md`](docs/13-DECISIONES-TECNICAS.md): decisiones de diseño y su porqué.
- [`14-PLAN-DE-DESARROLLO.md`](docs/14-PLAN-DE-DESARROLLO.md): próximas versiones.
