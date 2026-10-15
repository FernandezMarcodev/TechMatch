# TechMatch — Modelo de Dominio

## Entidades principales

### CV

Representa el documento original cargado.

```text
CV
├── id
├── originalFilename
├── storagePath
├── mimeType
├── sizeBytes
├── processingStatus
├── userId      (solo si el usuario lo guardó en su cuenta)
├── savedAt
├── createdAt
└── updatedAt
```

El texto extraído no forma parte del CV: se usa para armar el perfil y se descarta.

### CandidateProfile

Representa la información estructurada extraída del CV.

```text
CandidateProfile
├── id
├── cvId
├── seniority
├── totalExperienceYears
├── location
├── summary
├── experiences[]
├── education[]
├── skills[]
└── languages[]
```

### Experience

```text
Experience
├── company
├── position
├── description
├── startDate
├── endDate
├── years
└── skills[]
```

### Education

Una entrada por título (una línea con "Licenciatura … | Título intermedio: Analista …" da dos).

```text
Education
├── institution
├── degree
├── field
├── level
├── startDate
└── endDate
```

### Project

Proyecto personal o académico del CV (sección "Proyectos").

```text
Project
├── name
├── description
├── startDate
└── endDate
```

### Language

```text
Language
├── name
└── level
```

### Skill

Entidad normalizada reutilizable.

```text
Skill
├── id
├── name
└── normalizedName
```

Las skills del catálogo (`skill-catalog.ts`) tienen además un área (`LANGUAGES`, `FRONTEND`, `BACKEND`, `DATA`, `CLOUD_DEVOPS`, `PRACTICES`), usada por el panel de tendencias. Solo las del catálogo se comparan en el matching.

### JobOffer

```text
JobOffer
├── id
├── externalId
├── source
├── sourceUrl
├── title
├── company
├── location
├── modality
├── description
├── requirements[]
├── skills[]            (JobSkill: Skill + isRequired)
├── seniority
├── experienceYearsMin
├── educationRequirements   { level, fields[] }
├── languageRequirements[]  { name, level }
├── publishedAt
├── firstSeenAt
├── lastSeenAt
└── isActive
```

### MatchResult

```text
MatchResult
├── id
├── cvId
├── jobOfferId
├── score
├── level
├── criteria[]
├── reasons[]
└── calculatedAt
```

El motor de matching produce un `MatchEvaluation` (score, level, criteria, reasons) sin identificadores ni fechas, para ser determinístico. La aplicación lo completa como `MatchResult`.

### MatchCriterion

```text
MatchCriterion
├── criterion
├── score            (0–100 o null si es UNKNOWN)
├── weight           (peso configurado)
├── effectiveWeight  (peso aplicado tras redistribuir UNKNOWN)
├── status           (positive | partial | negative | neutral | unknown)
└── evidence
```

### MatchReason

```text
MatchReason
├── criterion
├── status   (positive | partial | negative | neutral)
└── message
```

`partial`: el criterio se cumple en parte. `neutral`: no exigido por la oferta o no evaluable (un `unknown` del criterio se expone como `neutral`).

### User, Session y EmailToken

Cuentas opcionales (`17-CUENTAS-DE-USUARIO.md`).

```text
User
├── id
├── email            (normalizado)
├── passwordHash     (scrypt)
├── emailVerifiedAt
├── createdAt
└── updatedAt

Session
├── id
├── userId
├── tokenHash        (SHA-256; el token no se guarda)
├── expiresAt
└── createdAt

EmailToken
├── id
├── userId
├── purpose          (VERIFY_EMAIL | RESET_PASSWORD)
├── tokenHash
├── expiresAt
├── usedAt
└── createdAt
```

## Relaciones

```text
CV
 │
 └── 1:1 CandidateProfile
          │
          ├── 1:N Experience
          ├── 1:N Education
          ├── 1:N Project
          ├── N:N Skill
          └── 1:N Language

CV ────────────── 1:N MatchResult

JobOffer ──────── 1:N MatchResult

JobOffer ──────── N:N Skill (con isRequired)

User ──────────── 1:N CV (solo los guardados)
User ──────────── 1:N Session
User ──────────── 1:N EmailToken
```

## Enumeraciones

### Estado del CV

```text
UPLOADED
PROCESSING
PROCESSED
FAILED
```

### Estado de JobOffer

```text
ACTIVE   (isActive = true)
INACTIVE (isActive = false)
```

### Nivel de match

```text
LOW
MEDIUM
HIGH
```

### Seniority

```text
INTERN < JUNIOR < SEMI_SENIOR < SENIOR < LEAD < MANAGER
UNKNOWN
```

### Modalidad

```text
REMOTE
HYBRID
ONSITE
UNKNOWN
```

### Nivel de idioma

```text
A1 < A2 < B1 < B2 < C1 < C2 < NATIVE
```

### Nivel educativo

```text
SECONDARY < TERTIARY < UNIVERSITY < POSTGRADUATE
```

### Fuente

```text
getonboard
lever
greenhouse
```

## Normalización compartida

El dominio contiene la normalización que usan por igual el procesamiento de CV, los conectores de fuentes y el matching:

* catálogo de tecnologías con aliases (`JS → JavaScript`, `Postgres → PostgreSQL`, `Node → Node.js`) y área de cada una;
* idiomas y niveles (CEFR y descriptores: "intermedio" → B1, "avanzado" → C1, "nativo" o "lengua materna" → NATIVE, "bilingüe" → C2);
* ubicaciones (provincias argentinas, CABA y otros países como regiones propias);
* seniority y nivel educativo por palabras clave explícitas (en las ofertas, el nivel educativo cuenta solo en líneas que hablan de estudios);
* ubicaciones argentinas (`isArgentineLocation`), para filtrar las páginas de empleo de empresas.

## Principio arquitectónico

Las entidades de dominio no deben depender de:

* React;
* Express;
* PostgreSQL;
* una librería de PDF;
* una fuente de ofertas específica.

El dominio debe ser independiente de infraestructura.
