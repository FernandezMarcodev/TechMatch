# Backlog

## Fase 1 — Foundation

* [x] Estructura de monorepo (`backend/`, `frontend/`, npm workspaces).
* [x] Node.js + TypeScript estricto.
* [x] React + Vite.
* [x] Variables de entorno validadas.
* [x] PostgreSQL en Docker.
* [x] Migraciones.
* [x] Testing (Vitest, Testing Library, Playwright).
* [x] ESLint y Prettier.

## Fase 2 — Dominio

* [x] Entidades y enumeraciones.
* [x] Catálogo de tecnologías con aliases.
* [x] Normalización de idiomas, ubicaciones, seniority y educación.

## Fase 3 — Base de datos

* [x] Esquema completo.
* [x] Repositorios.
* [x] Tests de integración de persistencia.

## Fase 4 — CV

* [x] Endpoint de carga.
* [x] Validación PDF por contenido.
* [x] Validación de tamaño.
* [x] Almacenamiento privado.
* [x] Compresión/optimización (paso no-op).
* [x] Extracción de texto.
* [x] OCR opcional (puerto definido, deshabilitado).
* [x] Limpieza y segmentación.
* [x] Extracción estructurada.
* [x] CandidateProfile.
* [x] Persistencia.
* [x] Procesamiento asíncrono.

## Fase 5 — Matching

* [x] Normalización de skills.
* [x] Skills obligatorias y deseables.
* [x] Comparación de experiencia.
* [x] Comparación de seniority.
* [x] Comparación de educación.
* [x] Comparación de idiomas.
* [x] Comparación de ubicación.
* [x] Comparación de modalidad.
* [x] Redistribución de pesos ante UNKNOWN.
* [x] Score ponderado.
* [x] Clasificación y mínimo técnico.
* [x] Razones.
* [x] Persistencia de resultados.
* [x] Tests.

## Fase 6 — Fuentes de ofertas

* [x] Interfaz `JobSourceConnector`.
* [x] Cliente HTTP con user-agent, timeouts, reintentos y ritmo.
* [x] Conector Get on Board.
* [x] Conectores Lever y Greenhouse (v2.2).
* [x] Normalización.
* [x] Deduplicación.
* [x] Persistencia.
* [x] Estado activo/inactivo.
* [x] Sincronización cada 12 h (en el backend o como proceso).
* [x] Logs.

## Fase 7 — API

* [x] POST `/api/cvs`.
* [x] GET `/api/cvs/:id`.
* [x] GET `/api/recommendations/:cvId`.
* [x] GET `/api/jobs/:id`.
* [x] Adaptación: GET `/api/cvs/:cvId/adaptations/:jobId` y POST `…/evaluation`.
* [x] Cuentas: `/api/auth/*` (registro, login, logout, me, verificación, recuperación, borrar cuenta).
* [x] CVs guardados: POST `/api/cvs/:cvId/save`, DELETE `/api/cvs/:cvId`, GET `/api/me/cvs`.
* [x] GET `/api/stats/offers` y GET `/api/cvs/:cvId/missing-skills`.
* [x] DTOs.
* [x] Validación.
* [x] Error handling.

## Fase 8 — Frontend (Material Design 3)

* [x] Tokens de diseño (solo tema claro).
* [x] Barra superior y pie con atribución de la fuente.
* [x] Inicio: portada, carga con arrastrar y soltar, cómo funciona, qué evaluamos.
* [x] Procesamiento.
* [x] Recomendaciones: nivel (sin puntaje numérico), razones, filtros, paginación.
* [x] Detalle.
* [x] Link a la fuente.
* [x] Cargar otro CV.
* [x] Responsive y accesible.

## Fase 9 — Calidad

* [x] Unit tests.
* [x] Integration tests.
* [x] E2E.
* [x] Security checks (validación de archivos, path traversal, logs sin CV).
* [x] Error handling.
* [x] Documentation.

## Fase 10 — Adaptación de CV (v2.0)

* [x] Especificación.
* [x] Borrador adaptado determinístico y sugerencias.
* [x] Editor con vista previa Harvard.
* [x] Recálculo con el motor de matching.
* [x] Exportación a PDF.
* [x] Tests unitarios, de integración, de frontend y E2E.

## Fase 11 — Despliegue gratuito (v2.0.1 a v2.0.4)

* [x] Frontend en Cloudflare Pages, API en Render, PostgreSQL en Neon.
* [x] Sincronización, recálculo y borrado de CVs vencidos en GitHub Actions cada 12 h.
* [x] CI en GitHub Actions; Render despliega `main` solo con el CI en verde.

## Fase 12 — Endurecimiento (v2.0.6)

* [x] Límite de subidas de CV por IP.
* [x] Borrado del PDF al procesar y de los CVs a los 30 días.
* [x] Catálogo de skills ampliado y casos de referencia del matching.

## Fase 13 — Cuentas de usuario (v2.1)

* [x] Registro, login, logout y usuario actual (scrypt, token Bearer con hash SHA-256).
* [x] Email (Mailpit en desarrollo, Brevo en producción).
* [x] Verificación de email obligatoria y recuperación de contraseña.
* [x] Portada con inicio de sesión y "Continuar sin cuenta".
* [x] Privilegios en la API: todas las recomendaciones y la adaptación requieren sesión.
* [x] CVs guardados (opt-in), "Mi cuenta", borrado de CVs y de la cuenta.
* [x] El texto extraído del CV no se guarda.

## Fase 14 — Más fuentes y tendencias (v2.2)

* [x] Conectores de Lever y Greenhouse, con filtro de tecnología en Argentina o remoto.
* [x] Panel público de tendencias (agregaciones SQL).
* [x] HIGH exige el 60 % de las tecnologías.
* [x] Recálculo de recomendaciones después de cada sincronización.

## Fase 15 — Gráficos, métricas y "Qué te falta" (v2.3)

* [x] Gráficos propios en CSS (rankings, anillos, columnas, barra apilada) y paleta clásica.
* [x] Tecnologías por área e inglés por seniority.
* [x] "Qué te falta" (`GET /api/cvs/{cvId}/missing-skills`).
* [x] Estado `partial` en las razones.
* [x] Solo se comparan tecnologías del catálogo; requisitos educativos con contexto de estudios; un registro por título en el CV.

## Pendiente

* [ ] Revisar formalmente los términos de uso de la API de Get on Board.
* [ ] v2.4: guardar CVs adaptados y preferencias del candidato (`14-PLAN-DE-DESARROLLO.md`).
