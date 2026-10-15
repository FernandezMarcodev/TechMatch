# API REST

Base:

```text
/api
```

Convenciones:

* Respuestas exitosas: `{ "data": ... }`.
* Errores: `{ "error": { "code", "message", "details" } }`.
* Identificadores: UUID.
* Los estados de CV se exponen en minúsculas (el dominio los usa en mayúsculas).
* Nunca se exponen entidades de base de datos ni rutas de almacenamiento: solo DTOs.
* Un identificador con formato inválido se responde como recurso inexistente (404).
* Mensajes en español.

## GET /api/health

Estado del servicio.

```json
{ "data": { "status": "ok" } }
```

## POST /api/cvs

Carga un CV y lo procesa en segundo plano.

### Request

```http
POST /api/cvs
Content-Type: multipart/form-data
```

Campo:

```text
file: PDF (un solo archivo)
```

El archivo se valida por contenido (firma PDF y apertura real del documento), no por el tipo declarado por el cliente.

### Response — 201 Created

```json
{
  "data": {
    "cvId": "4f7c2a1e-8d3b-4c5e-9a6f-1b2c3d4e5f60",
    "status": "processing"
  }
}
```

## GET /api/cvs/{cvId}

Obtiene el estado del procesamiento.

```json
{
  "data": {
    "id": "4f7c2a1e-8d3b-4c5e-9a6f-1b2c3d4e5f60",
    "status": "processed"
  }
}
```

Estados:

```text
uploaded
processing
processed
failed
```

## GET /api/recommendations/{cvId}

Devuelve las recomendaciones: solo `MEDIUM` y `HIGH`, de ofertas activas, ordenadas por score descendente. Mientras el CV no esté procesado, la lista está vacía.

**Sesión opcional** (privilegio de la cuenta): con `Authorization: Bearer <token>` válido devuelve todas; sin sesión (o con una vencida, que se trata como visitante y no da error) devuelve solo las primeras `ANONYMOUS_RECOMMENDATIONS_LIMIT` (3 por defecto) y cuenta el resto en `hiddenCount`. Las ocultas nunca llegan al cliente.

```json
{
  "data": {
    "cvId": "4f7c2a1e-8d3b-4c5e-9a6f-1b2c3d4e5f60",
    "hiddenCount": 0,
    "saved": false,
    "recommendations": [
      {
        "job": {
          "id": "9b1d7e2c-3f4a-4b5c-8d6e-7f8091a2b3c4",
          "title": "Backend Developer",
          "company": "Empresa X",
          "location": "Buenos Aires, Argentina",
          "modality": "HYBRID",
          "source": "getonboard",
          "sourceUrl": "https://www.getonbrd.com/jobs/backend-developer-empresa-x"
        },
        "match": {
          "level": "HIGH",
          "reasons": [
            {
              "criterion": "skills",
              "status": "positive",
              "message": "Coinciden 4 de 5 tecnologías requeridas (Java, Spring, SQL, Docker); faltan: Kubernetes"
            },
            {
              "criterion": "seniority",
              "status": "positive",
              "message": "Seniority compatible (Semi Senior)"
            }
          ]
        }
      }
    ]
  }
}
```

* `hiddenCount`: recomendaciones que existen pero no se devuelven por falta de sesión (`0` con sesión).
* `saved`: `true` si el CV está guardado en la cuenta de quien pregunta.
* `modality`: `REMOTE`, `HYBRID`, `ONSITE` o `null` si se desconoce.
* `reasons`: una por criterio (`skills`, `experience`, `seniority`, `education`, `languages`, `location`, `modality`), con estado `positive`, `negative` o `neutral`.

El endpoint no devuelve ofertas `LOW` ni el score numérico: el score es interno (clasificación y orden) y el usuario solo ve el nivel.

## GET /api/stats/offers

Panel público de tendencias (`18-PANEL-DE-TENDENCIAS.md`): agregaciones sobre las ofertas activas, sin datos de usuarios ni de CVs. No requiere sesión. Se recalcula como mucho cada `STATS_CACHE_MINUTES`.

```json
{
  "data": {
    "generatedAt": "2026-10-14T12:00:00.000Z",
    "totals": { "offers": 311, "companies": 105, "remotePercent": 47, "englishPercent": 23 },
    "topSkills": [{ "name": "REST", "count": 147, "percent": 47 }],
    "skillAreas": [{ "area": "BACKEND", "count": 588, "percent": 24 }],
    "seniority": [
      { "level": "SENIOR", "count": 146, "avgExperienceYears": 4.7, "englishPercent": 30 }
    ],
    "modality": [{ "modality": "REMOTE", "count": 147 }],
    "sources": [{ "source": "getonboard", "count": 296 }],
    "topCompanies": [{ "name": "Despegar", "count": 10 }]
  }
}
```

* `topSkills`: solo tecnologías requeridas (no las deseables); `percent` es sobre el total de ofertas activas.
* `skillAreas`: menciones de tecnologías requeridas del catálogo agrupadas por área (`LANGUAGES`, `FRONTEND`, `BACKEND`, `DATA`, `CLOUD_DEVOPS`, `PRACTICES`); `percent` es sobre el total de esas menciones.
* `seniority`: sin `UNKNOWN`, de junior a manager; `avgExperienceYears` es `null` si ninguna oferta del nivel indica años; `englishPercent` es el % de ofertas del nivel que piden inglés.
* `modality`: `null` agrupa las ofertas sin modalidad especificada.

## GET /api/cvs/{cvId}/missing-skills

"Qué te falta": las tecnologías del catálogo que más exigen las ofertas activas y que no aparecen en el CV, de la más pedida a la menos pedida (como mucho `MISSING_SKILLS_LIMIT`, 5 por defecto). Mismas reglas de acceso que el CV (un CV guardado responde `404` a quien no es su dueño); no requiere sesión. Lista vacía si el CV todavía no está procesado.

```json
{ "data": { "cvId": "…", "skills": [{ "name": "AWS", "percent": 28 }] } }
```

* `percent`: % de ofertas activas que la exigen.
* Solo tecnologías del catálogo: el CV se lee con el mismo catálogo, así que una etiqueta genérica nunca podría aparecer en él. Es una sugerencia; no modifica el CV ni el matching.

## GET /api/jobs/{jobId}

```json
{
  "data": {
    "id": "9b1d7e2c-3f4a-4b5c-8d6e-7f8091a2b3c4",
    "title": "Backend Developer",
    "company": "Empresa X",
    "location": "Buenos Aires, Argentina",
    "modality": "HYBRID",
    "description": "...",
    "requirements": [
      "3+ años de experiencia con Java",
      "Spring Boot",
      "SQL"
    ],
    "skills": [
      "Java",
      "Spring Boot",
      "SQL"
    ],
    "source": {
      "name": "getonboard",
      "url": "https://www.getonbrd.com/jobs/backend-developer-empresa-x"
    },
    "isActive": true
  }
}
```

## GET /api/cvs/{cvId}/adaptations/{jobId}

**Requiere sesión** (`Authorization: Bearer <token>`): adaptar el CV es un privilegio de la cuenta. Sin sesión válida responde `401 UNAUTHENTICATED`.

Borrador del CV adaptado a una oferta, más sugerencias. Detalle del documento y de las reglas en `15-ADAPTACION-DE-CV.md`. No guarda nada.

```json
{
  "data": {
    "job": { "id": "…", "title": "Backend Developer", "company": "Empresa X" },
    "document": {
      "personal": { "fullName": "", "headline": "Desarrolladora Backend", "email": "", "phone": "", "location": "Capital Federal, Buenos Aires", "links": [] },
      "summary": "Desarrolladora Backend Semi Senior con 7 años de experiencia en Java y Spring Boot.",
      "experiences": [{ "position": "…", "company": "…", "startDate": "2021-03", "endDate": null, "highlights": ["…"], "relevant": true }],
      "education": [{ "degree": "…", "institution": "…", "startDate": "2013", "endDate": "2019" }],
      "skills": [{ "name": "Java", "highlighted": true }],
      "languages": [{ "name": "Inglés", "level": "C1" }]
    },
    "suggestions": [{ "type": "MISSING_REQUIRED_SKILL", "skill": "Kubernetes", "message": "La oferta pide Kubernetes. Si tenés experiencia, agregala." }]
  }
}
```

## POST /api/cvs/{cvId}/adaptations/{jobId}/evaluation

**Requiere sesión**, igual que el borrador.

Evalúa el CV editado contra la oferta con el mismo motor de matching y lo compara con el CV original. No guarda nada.

Request: el `document` del borrador editado. Los datos personales identificatorios (nombre, email, teléfono, links) no se envían; si llegan, se descartan. Límites: 30 experiencias, 15 viñetas por experiencia, 20 estudios, 100 tecnologías, 15 idiomas, textos de hasta 2.000 caracteres; fechas `YYYY-MM` o `YYYY`.

```json
{
  "data": {
    "original": { "level": "MEDIUM" },
    "adapted": {
      "level": "HIGH",
      "reasons": [{ "criterion": "skills", "status": "positive", "message": "Coinciden 3 de 3 tecnologías requeridas (…)" }]
    }
  }
}
```

## CVs guardados

Guardar un CV es decisión del usuario (`17-CUENTAS-DE-USUARIO.md` § Datos personales). Un CV guardado responde `404 CV_NOT_FOUND` a cualquiera que no sea su dueño, en todos los endpoints que reciben su id. `GET /api/recommendations/{cvId}` incluye `saved` (`true` si el CV está en la cuenta de quien pregunta).

| Método y ruta | Request | Respuesta |
| --- | --- | --- |
| `POST /api/cvs/{cvId}/save` | sesión | `200 { data: { id, saved: true } }`; `409 CV_NOT_PROCESSED` si no terminó de procesarse |
| `GET /api/me/cvs` | sesión | `200 { data: { cvs: [{ id, originalFilename, createdAt, savedAt, recommendationCount }] } }` |
| `DELETE /api/cvs/{cvId}` | sesión (dueño) | `204`; borra el CV con su perfil y resultados |

## Cuentas: /api/auth

Detalle, reglas de seguridad y etapas en `17-CUENTAS-DE-USUARIO.md`. Los endpoints con sesión llevan `Authorization: Bearer <token>`; `user` es `{ id, email, emailVerified, createdAt }`.

| Método y ruta | Request | Respuesta |
| --- | --- | --- |
| `POST /api/auth/register` | `{ email, password }` | `201 { data: { user } }` |
| `POST /api/auth/login` | `{ email, password }` | `200 { data: { token, expiresAt, user } }` |
| `POST /api/auth/logout` | sesión | `204` |
| `GET /api/auth/me` | sesión | `200 { data: { user } }` |
| `POST /api/auth/verify-email` | `{ token }` | `200 { data: { user } }` |
| `POST /api/auth/verify-email/resend` | `{ email }` | `202`, siempre (no revela si el email tiene cuenta) |
| `POST /api/auth/password-reset` | `{ email }` | `202`, siempre |
| `POST /api/auth/password-reset/confirm` | `{ token, password }` | `204`; cierra todas las sesiones del usuario |
| `DELETE /api/auth/account` | sesión + `{ password }` | `204`; borra la cuenta y sus CVs guardados (`401 INVALID_CREDENTIALS` si la contraseña no es correcta) |

## Error contract

Todos los errores:

```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "El archivo debe estar en formato PDF.",
    "details": {}
  }
}
```

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `INVALID_FILE` | 400 | falta el archivo, no es PDF o está vacío |
| `FILE_TOO_LARGE` | 413 | supera el límite configurado |
| `PDF_NOT_PROCESSABLE` | 422 | PDF dañado, protegido o sin texto |
| `CV_PROCESSING_FAILED` | 422 | error durante el procesamiento |
| `CV_NOT_FOUND` | 404 | CV inexistente o id inválido |
| `JOB_NOT_FOUND` | 404 | oferta inexistente o id inválido |
| `CV_NOT_PROCESSED` | 409 | el CV todavía no terminó de procesarse o falló (adaptación) |
| `INVALID_CV_DOCUMENT` | 400 | el CV editado no cumple el formato o los límites (`details.issues`) |
| `RATE_LIMITED` | 429 | demasiadas subidas de CV o intentos de registro/login desde la misma IP; cabecera `Retry-After` y `details.retryAfterSeconds` |
| `INVALID_INPUT` | 400 | email con formato inválido o contraseña fuera de largo (`details.issues`) |
| `EMAIL_ALREADY_REGISTERED` | 409 | registro con un email que ya tiene cuenta |
| `INVALID_CREDENTIALS` | 401 | email o contraseña incorrectos (mismo error en los dos casos) |
| `UNAUTHENTICATED` | 401 | falta el token, o la sesión venció o no existe (también en los endpoints que son privilegios de la cuenta) |
| `EMAIL_NOT_VERIFIED` | 403 | login con la contraseña correcta de una cuenta sin verificar |
| `INVALID_TOKEN` | 400 | link de verificación o de recuperación inválido, vencido o ya usado |
| `INTERNAL_ERROR` | 500 | error inesperado |

HTTP utilizados:

```text
200 OK
201 Created
202 Accepted
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
413 Payload Too Large
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
```
