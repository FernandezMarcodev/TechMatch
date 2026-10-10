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
* **Autenticación:** email y contraseña, contraseñas con hash (bcrypt o argon2) y sesión en una cookie `httpOnly` guardada en PostgreSQL. Se prefiere a JWT por ser más simple y seguro para una aplicación de un solo dominio.
* **Email:** Nodemailer detrás de un puerto `EmailSender`. En desarrollo, Mailpit (SMTP de prueba en Docker) atrapa los mails; en producción, un proveedor SMTP configurado por variables de entorno; en tests, una implementación falsa.
* **Adaptar no es inventar:** el CV adaptado reordena, destaca y redacta lo que el CV ya contiene. Lo que la oferta pide y el CV no tiene se muestra como sugerencia y nunca se agrega automáticamente.
* **Fuera del plan:** login con Google, verificación de email, roles de administrador, nuevas fuentes de ofertas, OCR, IA y funcionalidades para empresas (ver `12-FUTURE-ROADMAP.md`).

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

## v2.1.0 — Cuentas de usuario (opcionales)

| # | Rama | Alcance |
| --- | --- | --- |
| 9 | `docs/spec-usuarios` | Especificación: alcance, seguridad, datos personales |
| 10 | `feat/auth-backend` | Usuarios y sesiones; registro, login, logout, usuario actual; hash de contraseñas; límite de intentos |
| 11 | `feat/auth-frontend` | Login, registro, menú de usuario, rutas protegidas |
| 12 | `feat/mis-cvs` | CVs vinculados al usuario (opcional); historial; borrado de CVs y de la cuenta |
| 13 | `feat/guardar-cv-adaptado` | Guardar y reabrir CVs adaptados (usuarios logueados) |

## v2.2.0 — Extras

| # | Rama | Alcance |
| --- | --- | --- |
| 14 | `feat/preferencias-candidato` | "Disponible para mudarme" y modalidad preferida como entradas del matching |
| 15 | `feat/recalculo-tras-sync` | Recalcular recomendaciones de usuarios cuando entran ofertas nuevas |
| 16 | `feat/recuperar-contrasena` | Recuperación de contraseña por email (Nodemailer + Mailpit en desarrollo) |
