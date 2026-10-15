# TechMatch

[![CI](https://github.com/FernandezMarcodev/TechMatch/actions/workflows/ci.yml/badge.svg)](https://github.com/FernandezMarcodev/TechMatch/actions/workflows/ci.yml)

Aplicación web que analiza un CV en PDF y recomienda ofertas de trabajo en tecnología compatibles, explicando por qué encaja cada una.

**Demo:** <https://techmatch-ynl.pages.dev> — la API está en el plan gratuito de Render y se duerme cuando no se usa: la primera carga puede tardar hasta un minuto.

## Funcionalidades

- **Matching determinístico y explicable**: tecnologías, seniority, experiencia, educación, idiomas, ubicación y modalidad. El mismo CV y la misma oferta siempre dan el mismo resultado, y cada recomendación muestra el porqué. Sin IA en el cálculo.
- **Recomendaciones siempre al día**: después de cada sincronización se recalculan las de todos los CVs analizados, así aparecen las ofertas nuevas y desaparecen las cerradas.
- **Ofertas reales** de la **API pública de Get on Board** y de las **páginas de empleo de empresas** que publican con Lever o Greenhouse (por ejemplo Despegar, Kavak y Clara), filtradas a puestos de tecnología en Argentina o remotos. Sin scraping; se actualizan cada 12 horas.
- **Cuenta opcional, con privilegios.** Sin registrarse se puede subir un CV y ver las primeras recomendaciones. Con una cuenta:
  - todas las recomendaciones;
  - **CV adaptado a una oferta**: editor con vista previa en formato Harvard, recálculo de la compatibilidad y descarga en PDF. Solo reordena y destaca lo que el CV ya tiene; lo que falta son sugerencias.
  - **CVs guardados, solo si el usuario lo elige**: historial en "Mi cuenta", con borrado de cada CV y de la cuenta completa.
- **Cuentas completas**: registro con verificación de email obligatoria, inicio de sesión, recuperación de contraseña por email.
- **Qué te falta**: junto a las recomendaciones, las tecnologías que más piden las ofertas activas y que no aparecen en tu CV, con el porcentaje de ofertas que exige cada una.
- **Panel público de tendencias**: tecnologías más pedidas y por área, seniority (con los años de experiencia promedio y cuántas piden inglés), modalidad, fuentes y empresas que más publican, calculados con agregaciones SQL sobre las ofertas activas y mostrados con gráficos propios en CSS (rankings, anillos y columnas, sin librería de gráficos).
- Interfaz en **Material Design 3**, responsive y en español.

## Seguridad y privacidad

- **Contraseñas** con `scrypt` (incluido en Node) y salt por usuario; comparación en tiempo constante.
- **Sesiones** con tokens aleatorios enviados en el encabezado `Authorization`; la base guarda solo su hash SHA-256. Se eligió frente a una cookie porque frontend y API están en dominios distintos.
- **Links por email** (verificación y recuperación) de un solo uso, con vencimiento y guardados como hash.
- **Los privilegios se aplican en la API**, no solo en la interfaz.
- **Respuestas que no revelan qué emails tienen cuenta**, y **límite de intentos por IP** en el login, el registro y la carga de CVs.
- **Minimización de datos y consentimiento**: el PDF y el texto del CV se descartan al terminar el análisis (se conserva solo el perfil estructurado). Todo CV se borra a los 30 días, salvo que el usuario elija guardarlo en su cuenta; un CV guardado solo lo ve su dueño.

## Stack

| Capa                  | Tecnologías                                                  |
| --------------------- | ------------------------------------------------------------ |
| Frontend              | React 19, TypeScript, Vite                                   |
| Backend               | Node.js, TypeScript, Express 5, Zod                          |
| Datos                 | PostgreSQL 16, migraciones SQL                               |
| Email                 | Nodemailer + Mailpit (desarrollo), API de Brevo (producción) |
| Tests                 | Vitest, Testing Library, Playwright                          |
| CI/CD                 | GitHub Actions                                               |
| Despliegue (gratuito) | Cloudflare Pages (frontend), Render (API), Neon (PostgreSQL) |

## Arquitectura

Backend en capas: `api` → `application` (casos de uso) → `domain` / `matching` (motor puro y determinístico). La infraestructura (base de datos, emails, fuentes de ofertas, archivos) implementa interfaces definidas en `application/ports.ts`, así que se puede cambiar sin tocar la lógica: por ejemplo, el proveedor de email se elige con una variable de entorno.

```text
backend/    API, procesamiento de CV, motor de matching, fuentes de ofertas, cuentas
frontend/   aplicación React
e2e/        tests end-to-end (incluye los emails reales, leídos desde Mailpit)
docs/       especificación (SRS, matching, API, base de datos, decisiones, plan)
```

## Requisitos

- Node.js 22.12 o superior (recomendado 24).
- Docker Desktop (PostgreSQL y Mailpit).

## Puesta en marcha local

```bash
npm install
npm run db:up                         # PostgreSQL (localhost:5434) y Mailpit (http://localhost:8025)
cp backend/.env.example backend/.env
npm run migrate -w backend            # crea las tablas
npm run sync-jobs -w backend          # descarga ofertas reales de Get on Board
```

En dos terminales:

```bash
npm run dev:backend                   # API en http://localhost:3000
npm run dev:frontend                  # App en http://localhost:5173
```

Abrí <http://localhost:5173>: podés crear una cuenta o seguir sin cuenta y subir un CV en PDF. Los emails (verificación, recuperación de contraseña) no salen de tu máquina: se ven en Mailpit, en <http://localhost:8025>.

## Tests y calidad

```bash
npm run lint             # ESLint
npm run format:check     # Prettier
npm run typecheck        # TypeScript
npm test                 # unitarios + integración (necesita la base levantada)
npm run test:e2e         # end-to-end con Playwright (necesita la base y Mailpit)
npm run ci               # todo lo anterior + build, igual que GitHub Actions
```

La primera vez, Playwright necesita su navegador: `npx playwright install chromium`.

Además de los tests de cada módulo, hay **casos de referencia del matching** (`backend/src/matching/golden-cases.test.ts`): pares realistas de CV y oferta con el nivel que esperaría una persona, que recorren el sistema completo.

## Documentación

La especificación completa está en [`docs/`](docs/). Puntos de entrada:

- [`01-SRS-IEEE-29148.md`](docs/01-SRS-IEEE-29148.md): requisitos.
- [`03-MATCHING-SPEC.md`](docs/03-MATCHING-SPEC.md): cómo se calcula la compatibilidad.
- [`17-CUENTAS-DE-USUARIO.md`](docs/17-CUENTAS-DE-USUARIO.md): cuentas, privilegios, sesiones y emails.
- [`13-DECISIONES-TECNICAS.md`](docs/13-DECISIONES-TECNICAS.md): decisiones de diseño y su porqué.
- [`14-PLAN-DE-DESARROLLO.md`](docs/14-PLAN-DE-DESARROLLO.md): versiones y próximos pasos.
- [`16-DESPLIEGUE.md`](docs/16-DESPLIEGUE.md): cómo desplegar gratis (Cloudflare Pages, Render, Neon, Brevo y sincronización en GitHub Actions).
