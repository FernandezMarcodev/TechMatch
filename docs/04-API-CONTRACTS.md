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

```json
{
  "data": {
    "cvId": "4f7c2a1e-8d3b-4c5e-9a6f-1b2c3d4e5f60",
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

* `modality`: `REMOTE`, `HYBRID`, `ONSITE` o `null` si se desconoce.
* `reasons`: una por criterio (`skills`, `experience`, `seniority`, `education`, `languages`, `location`, `modality`), con estado `positive`, `negative` o `neutral`.

El endpoint no devuelve ofertas `LOW` ni el score numérico: el score es interno (clasificación y orden) y el usuario solo ve el nivel.

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
| `INTERNAL_ERROR` | 500 | error inesperado |

HTTP utilizados:

```text
200 OK
201 Created
400 Bad Request
404 Not Found
409 Conflict
413 Payload Too Large
422 Unprocessable Entity
500 Internal Server Error
```
