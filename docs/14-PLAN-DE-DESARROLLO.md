# Plan de desarrollo

Evolución de TechMatch después del MVP (`v1.0.0`), organizada por versiones y ramas de git.

## Forma de trabajo

* Una rama por ticket, creada desde `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
* Commits con prefijo ([Conventional Commits](https://www.conventionalcommits.org/)): `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
* Cada rama incluye código, tests y actualización de la documentación.
* Al terminar un ticket, con `npm run ci` en verde:
  1. se sube la rama a GitHub;
  2. se mergea **directamente** a `main` con `git merge --no-ff` (sin Pull Request), dejando un commit de merge que identifica la rama;
  3. se sube `main`. El CI corre en cada push a `main`.
* Las ramas se conservan en GitHub después del merge.
* Un tag por versión (`vX.Y.Z`) sobre `main`.

## Decisiones de alcance

* **Primero la adaptación del CV, después las cuentas.** La adaptación no depende de las cuentas y es la funcionalidad principal; así cada versión aporta valor visible por sí sola.
* **Cuentas opcionales.** El flujo anónimo (subir CV y ver recomendaciones) se mantiene. La cuenta agrega guardar CVs, historial, CVs adaptados y borrado de datos.
* **Autenticación:** email y contraseña; contraseñas con hash `scrypt` (incluido en Node); sesión con un token aleatorio que el frontend manda en el encabezado `Authorization` y del que la base guarda solo el hash. No se usa cookie porque frontend y API están en dominios distintos y Safari bloquea las cookies de terceros (detalle en `17-CUENTAS-DE-USUARIO.md`).
* **Email:** puerto `EmailSender`. En desarrollo, Nodemailer contra Mailpit (SMTP de prueba en Docker que atrapa los mails); en producción, la API HTTP de Brevo (plan gratuito), porque Render free bloquea los puertos SMTP; en tests, una implementación falsa.
* **Cuentas en pasos:** primero la cuenta básica (registro y login), después el email con la verificación obligatoria para entrar, y por último la recuperación de contraseña.
* **Simplicidad:** es un proyecto universitario que se defiende en entrevistas; cada cambio tiene que poder explicarse en pocas frases. Se evitan servicios nuevos y dependencias pesadas si no son necesarias.
* **Datos personales con vencimiento:** los CVs anónimos se borran pasado un plazo configurable. Cuando existan cuentas, el borrado automático aplica solo a los CVs sin usuario; los de un usuario viven hasta que él los borre o borre la cuenta.
* **Adaptar no es inventar:** el CV adaptado reordena, destaca y redacta lo que el CV ya contiene. Lo que la oferta pide y el CV no tiene se muestra como sugerencia y nunca se agrega automáticamente.
* **Fuera del plan:** login con Google, roles de administrador, nuevas fuentes de ofertas, OCR, IA y funcionalidades para empresas (ver `12-FUTURE-ROADMAP.md`).

## v1.0.0 — MVP

Carga de CV, matching determinístico explicado, ofertas de Get on Board, interfaz Material Design 3. ✅

## v1.1.0 — Bases sólidas

| # | Rama | Alcance |
| --- | --- | --- |
| 1 | `docs/plan-de-desarrollo` | Este plan y el alcance de las próximas versiones en la documentación |
| 2 | `chore/ci-github-actions` | GitHub Actions con lint, typecheck y tests (con PostgreSQL) en cada PR |
| 3 | `fix/cv-en-proceso-tras-reinicio` | Al iniciar el backend, los CVs que quedaron en `PROCESSING` pasan a `FAILED` |

## v2.0.0 — CV adaptado a una oferta

| # | Rama | Alcance |
| --- | --- | --- |
| 4 | `docs/spec-adaptacion-cv` | Especificación (`15-ADAPTACION-DE-CV.md`): flujo, regla de no inventar, contrato de la API |
| 5 | `feat/cv-adaptado-backend` | Endpoint que arma el borrador: tecnologías coincidentes primero, experiencias relevantes destacadas, resumen por plantilla, sugerencias aparte |
| 6 | `feat/editor-cv` | Editor por secciones con vista previa en formato Harvard; el CV editado vive en el navegador |
| 7 | `feat/recalcular-compatibilidad` | Endpoint que evalúa el CV editado contra la oferta con el mismo motor de matching |
| 8 | `feat/exportar-pdf` | Exportación a PDF mediante CSS de impresión |

## v2.0.1 — Despliegue gratuito

| # | Rama | Alcance |
| --- | --- | --- |
| — | `chore/despliegue-gratuito` | El backend sirve el frontend compilado; `render.yaml` (Render free), base en Neon free, sincronización programada en GitHub Actions; guía `16-DESPLIEGUE.md` |

## v2.0.2 — Correcciones tras probar el sistema

| # | Rama | Alcance |
| --- | --- | --- |
| — | `chore/solo-tema-claro` | Solo tema claro: se elimina el esquema oscuro |
| — | `fix/seniority-oferta` | Una diferencia de seniority de dos niveles o más (p. ej. oferta Senior y CV Junior) impide la recomendación; el seniority del título prevalece sobre la categoría declarada |
| — | `fix/nivel-idioma-nativo` | Nivel de idioma "Nativo" en el perfil, el matching y el editor de CV |
| — | `fix/vinetas-texto-cv` | Las viñetas que ocupan varios renglones del PDF se unen en una sola |
| — | `feat/cv-harvard-proyectos` | Proyectos personales extraídos del CV y CV adaptado con el formato de Harvard |
| — | `feat/vista-previa-a4` | Vista previa del CV como hoja A4 idéntica al PDF, con saltos de página y vista ampliada |
| — | `fix/vista-previa-paginas` | La vista previa divide el CV en hojas A4 separadas, igual que el PDF |
| — | `fix/pdf-sin-encabezado` | El PDF sale sin el encabezado y pie del navegador (fecha, título con la empresa, URL) |

## v2.0.4 — Frontend y backend por separado

| # | Rama | Alcance |
| --- | --- | --- |
| — | `chore/despliegue-cloudflare-render` | Frontend en Cloudflare Pages (`VITE_API_URL`) y API en Render (`CORS_ORIGIN` con varios orígenes); la portada despierta la API; guía `16-DESPLIEGUE.md` actualizada |

## v2.0.6 — Endurecimiento

| # | Rama | Alcance |
| --- | --- | --- |
| — | `docs/plan-v2-0-6` | Esta versión en el plan; cuentas simplificadas |
| — | `feat/limite-de-subidas` | Límite de subidas de CV por IP y ventana de tiempo (configurable); al superarlo, error `429` en español |
| — | `feat/borrado-de-datos` | El PDF se borra al terminar de procesarse; los CVs anónimos con más de N días (configurable) se borran con sus perfiles y resultados, en el workflow de sincronización |
| — | `feat/catalogo-skills-y-casos-de-prueba` | Más alias en el catálogo de skills y casos fijos CV + oferta con el nivel esperado como tests del matching |

## v2.1.0 — Cuentas de usuario (opcionales)

| # | Rama | Alcance |
| --- | --- | --- |
| 9 | `docs/spec-usuarios` | Especificación (`17-CUENTAS-DE-USUARIO.md`): alcance, seguridad, sesiones, email, datos personales |
| 10 | `feat/auth-backend` | Usuarios y sesiones; registro, login, logout, usuario actual; hash de contraseñas; límite de intentos |
| 11 | `feat/auth-frontend` | Registro, login, menú de usuario, rutas protegidas |
| 12 | `feat/email` | Puerto `EmailSender`: Mailpit en desarrollo, Brevo en producción, implementación falsa en tests |
| 13 | `feat/verificar-email` | Email de verificación al registrarse; sin verificar no se puede entrar; reenvío del email |
| 14 | `feat/recuperar-contrasena` | "Olvidé mi contraseña": link por email de un solo uso y con vencimiento |
| 15 | `feat/mis-cvs` | CVs vinculados al usuario (opcional); historial; borrado de CVs y de la cuenta |
| 16 | `feat/guardar-cv-adaptado` | Guardar y reabrir CVs adaptados (usuarios logueados) |

## v2.2.0 — Extras

| # | Rama | Alcance |
| --- | --- | --- |
| 17 | `feat/preferencias-candidato` | "Disponible para mudarme" y modalidad preferida como entradas del matching |
| 18 | `feat/recalculo-tras-sync` | Recalcular recomendaciones de usuarios cuando entran ofertas nuevas |
| 19 | `feat/que-te-falta` | En las recomendaciones, las tecnologías que más piden las ofertas y que el CV no tiene |
