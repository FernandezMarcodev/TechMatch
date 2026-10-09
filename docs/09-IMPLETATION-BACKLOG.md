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
* [x] DTOs.
* [x] Validación.
* [x] Error handling.

## Fase 8 — Frontend (Material Design 3)

* [x] Tokens de diseño (claro y oscuro).
* [x] Barra superior y pie con atribución de la fuente.
* [x] Inicio: portada, carga con arrastrar y soltar, cómo funciona, qué evaluamos.
* [x] Procesamiento.
* [x] Recomendaciones: puntaje, nivel, razones, filtros, paginación.
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

## Pendiente

* [ ] Production configuration (despliegue, HTTPS, almacenamiento de archivos).
* [ ] Revisar los términos de uso de la API de Get on Board antes de producción.

Las próximas versiones (v1.1 a v2.2) y sus ramas están en `14-PLAN-DE-DESARROLLO.md`.
