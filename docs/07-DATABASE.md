# Base de datos

PostgreSQL 16. Migraciones SQL versionadas en `backend/migrations` (node-pg-migrate).

Fechas con zona horaria (`TIMESTAMPTZ`). Valores enumerados en mayúsculas, restringidos con `CHECK`.

## cvs

```text
id UUID PK
original_filename VARCHAR
storage_path TEXT
mime_type VARCHAR
size_bytes INTEGER
extracted_text TEXT NULL
processing_status VARCHAR   (UPLOADED | PROCESSING | PROCESSED | FAILED)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## candidate_profiles

```text
id UUID PK
cv_id UUID UNIQUE FK
summary TEXT NULL
seniority VARCHAR NULL      (INTERN … MANAGER | UNKNOWN)
total_experience_years DECIMAL NULL
location VARCHAR NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## experiences

```text
id UUID PK
candidate_profile_id UUID FK
company VARCHAR NULL
position VARCHAR NULL
description TEXT NULL
start_date DATE NULL
end_date DATE NULL
years DECIMAL NULL
created_at TIMESTAMPTZ
```

Las tecnologías de cada experiencia se incorporan a las skills del perfil.

## education

```text
id UUID PK
candidate_profile_id UUID FK
institution VARCHAR NULL
degree VARCHAR NULL
field VARCHAR NULL
level VARCHAR NULL          (SECONDARY | TERTIARY | UNIVERSITY | POSTGRADUATE | UNKNOWN)
start_date DATE NULL
end_date DATE NULL
created_at TIMESTAMPTZ
```

## projects

```text
id UUID PK
candidate_profile_id UUID FK
name VARCHAR NULL
description TEXT NULL
start_date DATE NULL
end_date DATE NULL
position SMALLINT           (orden en el CV)
created_at TIMESTAMPTZ
```

## languages

```text
id UUID PK
candidate_profile_id UUID FK
name VARCHAR
level VARCHAR NULL          (A1 … C2, NATIVE)
created_at TIMESTAMPTZ
```

## skills

```text
id UUID PK
name VARCHAR UNIQUE
normalized_name VARCHAR UNIQUE
```

## candidate_skills

```text
candidate_profile_id UUID FK
skill_id UUID FK
PRIMARY KEY(candidate_profile_id, skill_id)
```

## job_offers

```text
id UUID PK
external_id VARCHAR NULL
source VARCHAR              (getonboard)
source_url TEXT
title VARCHAR
company VARCHAR
location VARCHAR NULL
modality VARCHAR NULL       (REMOTE | HYBRID | ONSITE | UNKNOWN)
description TEXT
requirements TEXT           (una línea por requisito)
seniority VARCHAR NULL
experience_years_min DECIMAL NULL
education_requirements JSONB NULL     { level, fields[] }
language_requirements JSONB           [{ name, level }]
published_at TIMESTAMPTZ NULL
first_seen_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
is_active BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## job_skills

```text
job_offer_id UUID FK
skill_id UUID FK
is_required BOOLEAN         (false = deseable)
PRIMARY KEY(job_offer_id, skill_id)
```

## match_results

```text
id UUID PK
cv_id UUID FK
job_offer_id UUID FK
score DECIMAL
level VARCHAR               (LOW | MEDIUM | HIGH)
criteria_json JSONB
reasons_json JSONB
calculated_at TIMESTAMPTZ
UNIQUE(cv_id, job_offer_id)
```

Se guardan los resultados de todos los niveles. Recalcular un CV reemplaza sus resultados.

## Índices

```text
job_offers(source, external_id)   UNIQUE, donde external_id no es nulo
job_offers(source_url)            UNIQUE
job_offers(is_active)
job_offers(last_seen_at)

match_results(cv_id, score DESC)

candidate_skills(skill_id)
job_skills(skill_id)
```

## Integridad

* Foreign keys (borrado en cascada desde CV, perfil y oferta).
* Unique constraints.
* Score entre 0 y 100.
* Estados y enumeraciones restringidos.
* No duplicar skills normalizadas.
* Las ofertas no se borran: se desactivan.

## Bases por entorno

| Base | Uso |
| --- | --- |
| `techmatch` | desarrollo |
| `techmatch_test` | tests de integración (se vacía en cada test) |
| `techmatch_e2e` | tests end-to-end |
