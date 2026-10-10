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
├── extractedText
├── processingStatus
├── createdAt
└── updatedAt
```

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

```text
Education
├── institution
├── degree
├── field
├── level
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
├── status           (positive | negative | neutral | unknown)
└── evidence
```

### MatchReason

```text
MatchReason
├── criterion
├── status   (positive | negative | neutral)
└── message
```

## Relaciones

```text
CV
 │
 └── 1:1 CandidateProfile
          │
          ├── 1:N Experience
          ├── 1:N Education
          ├── N:N Skill
          └── 1:N Language

CV ────────────── 1:N MatchResult

JobOffer ──────── 1:N MatchResult

JobOffer ──────── N:N Skill (con isRequired)
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
```

## Normalización compartida

El dominio contiene la normalización que usan por igual el procesamiento de CV, los conectores de fuentes y el matching:

* catálogo de tecnologías con aliases (`JS → JavaScript`, `Postgres → PostgreSQL`, `Node → Node.js`);
* idiomas y niveles (CEFR y descriptores: "intermedio" → B1, "avanzado" → C1, "nativo" o "lengua materna" → NATIVE, "bilingüe" → C2);
* ubicaciones (provincias argentinas, CABA y otros países como regiones propias);
* seniority y nivel educativo por palabras clave explícitas.

## Principio arquitectónico

Las entidades de dominio no deben depender de:

* React;
* Express;
* PostgreSQL;
* una librería de PDF;
* una fuente de ofertas específica.

El dominio debe ser independiente de infraestructura.
