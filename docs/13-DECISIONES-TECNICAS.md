# Decisiones técnicas

Decisiones de diseño del MVP y su fundamento. Los documentos `01`–`12` definen el qué; este documento explica el cómo y el porqué de las elecciones que no son evidentes.

## Stack

| Área | Elección | Motivo |
| --- | --- | --- |
| Monorepo | npm workspaces (`backend/`, `frontend/`) | Sin herramientas extra. |
| Backend HTTP | Express 5 | Simple; maneja errores async de forma nativa. |
| Validación de configuración | zod | Variables de entorno y configuración de matching tipadas y validadas al arrancar. |
| Base de datos | PostgreSQL 16 (Docker, puerto 5434) + `pg` | Datos relacionales; SQL explícito en repositorios, sin ORM que acople el dominio. |
| Migraciones | `node-pg-migrate` con archivos SQL | Esquema versionado y legible. |
| PDF | `unpdf` (pdf.js) | Texto con posiciones para reconstruir líneas, sin binarios nativos. |
| HTML | `cheerio` | Convertir a texto el HTML de las descripciones de ofertas. |
| Logs | `pino` | JSON estructurado; redacción defensiva de campos de texto del CV. |
| Tests | Vitest (unit + integración con base real), Testing Library, Playwright | Unit sin dependencias; integración y E2E contra PostgreSQL real. |
| Frontend | React 19 + Vite + react-router | |
| UI | Material Design 3 con tokens y CSS propios | Sin librería de componentes: menos peso y control total del diseño. |

TypeScript se fija en `~6.0` por compatibilidad con `typescript-eslint`.

## Arquitectura

* El dominio (`domain/`) y el motor de matching (`matching/`) son código puro, sin dependencias de infraestructura.
* La aplicación (`application/`) define puertos (`ports.ts`) que implementan `persistence/`, `cv-processing/`, `job-sources/` e `infrastructure/`.
* `main/container.ts` es la raíz de composición. Los puntos de entrada son el servidor, la sincronización de ofertas y las migraciones.
* La normalización (tecnologías, idiomas, ubicaciones, seniority, educación) vive en el dominio y la comparten CV, fuentes y matching, para que ambos lados del match hablen el mismo vocabulario.

## Fuentes de ofertas: API en lugar de scraping

Los portales de empleo masivos de la región (Computrabajo, Zona Jobs, Bumeran) protegen sus sitios contra el acceso automatizado (AWS WAF, Cloudflare). El proyecto no evade bloqueos ni controles de acceso, así que el MVP se basa en fuentes que ofrecen una interfaz pública para acceso automatizado.

La fuente elegida es **Get on Board**:

* especializada en tecnología en Latinoamérica;
* API pública, sin clave;
* datos estructurados que mejoran el matching: tecnologías declaradas como tags, requisitos y deseables separados, seniority y modalidad explícitos.

La arquitectura de conectores permite sumar fuentes sin tocar el resto del sistema (ver `05-FUENTES-DE-OFERTAS.md`).

Limitación conocida: la mayoría de las ofertas son remotas o de otros países de la región, con pocas sedes en Argentina. Ampliar fuentes está en el roadmap.

## Despliegue gratuito

El despliegue no puede tener costo (ver `16-DESPLIEGUE.md`):

* **Un solo servicio** (Render free) ejecuta la API y sirve el frontend compilado (`FRONTEND_DIST_DIR`): una URL, mismo origen, sin CORS.
* **PostgreSQL en Neon free:** la base gratuita de Render expira a los 30 días.
* **Sincronización en GitHub Actions:** el servicio gratuito se duerme sin visitas, así que el scheduler interno no es confiable; el repositorio público tiene minutos ilimitados.
* **Migraciones al arrancar:** son idempotentes y no dependen de funciones pagas de la plataforma.
* **Por qué no Cloudflare:** su plan gratuito limita cada request a 10 ms de CPU, insuficiente para procesar un CV; Containers requiere el plan pago. Queda como alternativa futura.

## Convenciones de API y datos

* Identificadores UUID.
* Estados de CV en mayúsculas en el dominio y en minúsculas en la API; el mapeo ocurre en los DTOs.
* Modalidad desconocida se expone como `null`.
* Un id con formato inválido responde 404 del recurso correspondiente: ese recurso no puede existir.
* Los requisitos de una oferta se guardan como TEXT, una línea por requisito, y se exponen como lista.
* Los requisitos de educación e idiomas de una oferta se guardan como JSONB.
* Recalcular el matching de un CV reemplaza sus resultados (`UNIQUE(cv_id, job_offer_id)`).

## Matching

Los valores concretos están en `03-MATCHING-SPEC.md` y en `matching-config.ts`. Fundamentos:

* **Prioridad tecnologías > seniority > experiencia > resto:** es el orden en que una persona de selección técnica descarta candidatos. Pesos 35 / 25 / 20, y el 20 % restante se reparte entre educación (10), idiomas (5), ubicación y modalidad (2,5 cada una).
* **Educación valorada aunque la oferta no la pida:** si no, todos los candidatos sacarían lo mismo y el criterio no aportaría información. Una carrera afín a informática vale más; una ingeniería o licenciatura de otra área suma porque se presume una base general. Si el CV no informa educación, el criterio no se evalúa y no penaliza.
* **Obligatorias pesan el doble que deseables:** refleja el lenguaje de las ofertas ("excluyente" vs "deseable") y se reduce a la fórmula simple cuando no hay distinción.
* **Requisito ausente en la oferta → 100 neutral (salvo educación, que valora la formación); dato ausente en el CV → UNKNOWN redistribuido:** ninguno de los dos casos penaliza, y ninguno se inventa.
* **Tecnologías obligatorias para recomendar:** si no se pueden comparar, el resultado es LOW con una razón que dice "no se pudo evaluar". Se informa falta de evidencia, no incompatibilidad.
* **Mínimo técnico de 40:** en ofertas reales, los criterios que rara vez restringen (remoto, sin requisitos de experiencia o idioma) suman una parte grande del puntaje aunque no haya afinidad técnica. Sin un mínimo, ofertas con casi ninguna tecnología en común llegarían a MEDIUM. Con el mínimo, una oferta debe compartir al menos una parte relevante del stack para recomendarse. Es configurable.
* **Modalidad incompatible excluye:** con ubicación y modalidad pesando poco, una oferta presencial en otro país casi no perdía puntaje. Como el candidato no podría asistir, se excluye (mínimo de modalidad). La disponibilidad para mudarse queda en el roadmap como opción del usuario.
* **Score interno:** el usuario ve el nivel (alta/media) con un indicador de barras y las razones. Un número exacto invita a sobreinterpretar diferencias pequeñas; se usa solo para clasificar y ordenar.
* **Ubicación por regiones:** CABA y provincia de Buenos Aires forman una región. Cada país es una región propia: una oferta presencial en Santiago de Chile es incompatible con un CV de Buenos Aires.
* **Razones = cálculo:** cada evaluador de criterio devuelve score, estado y mensaje juntos, de modo que la explicación no puede divergir del puntaje.

## Procesamiento de CV

* Validación por contenido (firma `%PDF-` y apertura real), nunca por el MIME declarado.
* Archivo guardado como `<uuid>.pdf` en un directorio privado; la ruta se valida al leer para impedir path traversal.
* Extracción heurística y conservadora: secciones por títulos conocidos, rangos de fechas para experiencias, palabras explícitas para seniority, educación e idiomas. El seniority no se deduce de los años.
* Compresión: paso no-op (archivos chicos y privados).
* OCR: puerto `OcrProvider` deshabilitado. Requiere renderizar páginas con canvas nativo y un motor OCR. Un PDF sin texto termina en `failed` con un mensaje claro.
* Procesamiento asíncrono en el proceso del backend (`TaskRunner`); el cliente consulta el estado. Al iniciar, los CVs interrumpidos por un reinicio pasan a `FAILED` para no quedar "procesando" indefinidamente. Es suficiente para una instancia; escalar a varias requiere una cola persistente.
* Las recomendaciones se calculan al procesar el CV, contra las ofertas activas en ese momento.

## Frontend

* **Material Design 3:** roles de color, forma, elevación y escala tipográfica como variables CSS (`styles/tokens.css`), con un único esquema claro: el tema oscuro se descartó porque la interfaz se veía y se leía mejor en claro, y mantener un solo esquema simplifica el diseño y las pruebas (`color-scheme: light` evita que el navegador oscurezca controles nativos).
* **Íconos SVG propios** (`components/Icon.tsx`) en lugar de una fuente de íconos o una librería.
* **Color:** la paleta principal es azul; el verde (con acentos cian y ámbar) comunica lo positivo y da vida a la portada, los pasos de "Cómo funciona" y los criterios. Los criterios prioritarios (tecnologías, seniority, experiencia) se destacan en azul pleno.
* **Tipografía Roboto** desde Google Fonts, con fuentes del sistema como respaldo.
* **Recomendaciones:**
  * indicador de nivel de tres barras (sin número) y chip de nivel;
  * resumen de hasta tres razones (tecnologías primero, luego incompatibilidades y coincidencias) con opción de ver el análisis completo;
  * filtros por nivel y modalidad remota en el cliente, sin alterar el orden;
  * paginación incremental de 15 en 15.
* **Accesibilidad:** inputs reales con etiqueta (también en la zona de arrastre), foco visible, `aria-pressed` y `aria-expanded` en controles, y respeto de `prefers-reduced-motion`.

## Testing

* **Unit:** dominio, matching, CV y fuentes, sin red ni base. Los PDFs de prueba se generan en código y los datos de la API se simulan con fixtures sintéticos de la misma forma.
* **Integración:** persistencia, API y sincronización contra una base `techmatch_test` que se vacía en cada test.
* **E2E:** Playwright levanta backend y frontend sobre `techmatch_e2e` y recorre carga → procesamiento → recomendaciones → detalle.
