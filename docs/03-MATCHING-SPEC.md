# Motor de Matching

## Objetivo

Calcular la compatibilidad entre un `CandidateProfile` y un `JobOffer`.

El motor será:

* determinístico;
* explicable;
* configurable;
* testeable;
* independiente de HTTP, de React y de la base de datos.

No utilizará IA generativa para decidir el score.

Firma:

```text
evaluateMatch(CandidateProfile, JobOffer, MatchingConfig) → MatchEvaluation
```

## Prioridad y pesos

Orden de importancia:

1. **Tecnologías.**
2. **Seniority.**
3. **Experiencia.**
4. Todo lo demás, con la educación primero.

| Criterio             |     Peso |
| -------------------- | -------: |
| Skills / tecnologías |      35% |
| Seniority            |      25% |
| Experiencia          |      20% |
| Educación            |      10% |
| Idiomas              |       5% |
| Ubicación            |     2,5% |
| Modalidad            |     2,5% |
| **Total**            | **100%** |

Las razones se presentan en este mismo orden.

Todos los valores de este documento están en configuración (`matching-config.ts`) y pueden sobrescribirse con un archivo JSON. La configuración se valida al cargarse (los pesos deben sumar 1).

## Fórmula

```text
score =
    skills       × 0.35
  + seniority    × 0.25
  + experience   × 0.20
  + education    × 0.10
  + languages    × 0.05
  + location     × 0.025
  + modality     × 0.025
```

Cada criterio devuelve un valor de 0 a 100 o `UNKNOWN`. El score final se redondea a entero.

## Skills

Normalizar:

* mayúsculas/minúsculas;
* espacios;
* puntuación;
* aliases.

Ejemplos:

```text
JS       → JavaScript
TS       → TypeScript
Node     → Node.js
Postgres → PostgreSQL
```

El sistema mantiene un diccionario de aliases. En texto libre, un término solo se reconoce como palabra completa: "Java" no coincide dentro de "JavaScript" y el ".js" de "Node.js" no se interpreta como JavaScript.

### Fórmula

Las tecnologías obligatorias pesan el doble que las deseables:

```text
skillsScore =
    (2 × obligatoriasCoincidentes + 1 × deseablesCoincidentes)
  / (2 × obligatorias            + 1 × deseables)
  × 100
```

Si todas son obligatorias, equivale a `skillsMatched / skillsRequired × 100`.

Si la oferta o el CV no tienen tecnologías reconocibles, el criterio es `UNKNOWN`.

## Experiencia

Si la oferta exige años de experiencia:

```text
candidateYears >= requiredYears → 100
candidateYears <  requiredYears → candidateYears / requiredYears × 100
```

Si no existe requisito explícito: 100 con razón neutral (no penaliza).

Si la oferta lo exige y el CV no permite determinarlo: `UNKNOWN`.

## Seniority

Orden:

```text
INTERN
JUNIOR
SEMI_SENIOR
SENIOR
LEAD
MANAGER
```

Por distancia de niveles:

| Distancia | Score |
| --------: | ----: |
| 0 | 100 |
| 1 | 60 |
| 2 o más | 20 |

Si se desconoce en la oferta o en el CV: `UNKNOWN`. No se deduce de los años de experiencia.

## Educación

La educación siempre suma información: se valora la formación del CV aunque la oferta no la pida.

### Carreras afines a informática

Se consideran afines las áreas relacionadas con sistemas, informática, computación, software, programación, datos, inteligencia artificial, ciberseguridad, tecnologías de la información y telecomunicaciones.

### Oferta sin requisito de educación

Se toma la mejor formación del CV:

| Formación | Score |
| --- | ---: |
| Universitaria o posgrado afín a informática | 100 |
| Universitaria o posgrado de otra área (una ingeniería o licenciatura aporta base general) | 75 |
| Terciaria afín a informática | 85 |
| Terciaria de otra área | 50 |
| Secundaria | 40 |
| El CV no informa educación | `UNKNOWN` |

### Oferta con requisito de educación

* El candidato alcanza o supera el nivel: 100.
* Un nivel por debajo: 50. Más de un nivel por debajo: 0.
* Área: coincide si una contiene a la otra o si ambas son afines a informática ("Informática" requerida, "Ciencias de la Computación" estudiada). Si no coincide, el valor se multiplica por 0,5.
* El CV no informa educación: `UNKNOWN`.

## Idiomas

Orden de referencia:

```text
A1 < A2 < B1 < B2 < C1 < C2
```

Por cada idioma requerido:

* nivel del CV igual o superior: 100;
* nivel inferior: `(nivelCV + 1) / (nivelRequerido + 1) × 100`;
* el CV menciona otros idiomas pero no el requerido: 0;
* el CV menciona el idioma sin nivel y la oferta pide nivel: no se evalúa ese requisito.

El criterio es el promedio de los requisitos evaluados. La oferta sin requisitos de idioma: 100, neutral. El CV sin idiomas: `UNKNOWN`.

## Ubicación

Estados normalizados:

| Estado | Score |
| --- | ---: |
| `SAME_CITY` | 100 |
| `SAME_REGION` | 70 |
| `REMOTE` | 100 |
| `INCOMPATIBLE` | 0 |
| `UNKNOWN` | — |

CABA y la provincia de Buenos Aires son la misma región. Cada país distinto de Argentina es una región propia.

No asumir compatibilidad cuando no hay información.

## Modalidad

Normalizar:

```text
REMOTE
HYBRID
ONSITE
UNKNOWN
```

* Remota: compatible (100).
* Híbrida o presencial: compatible (100) si el CV está en la misma ciudad o región; incompatible (0) si está en otra región o país; `UNKNOWN` si falta la ubicación del CV.
* Una modalidad incompatible **excluye** la oferta (ver Clasificación).

## Datos faltantes

Regla fundamental:

> `UNKNOWN` no significa `MATCH` ni `NO MATCH`.

Los criterios `UNKNOWN` se excluyen y su peso se redistribuye proporcionalmente entre los criterios evaluados, para no penalizar artificialmente un CV incompleto.

## Clasificación

```text
0–49   → LOW
50–74  → MEDIUM
75–100 → HIGH
```

Además, el resultado es `LOW` cuando:

* **las tecnologías no pueden evaluarse** (criterio obligatorio `UNKNOWN`). La razón lo informa como falta de evidencia, no como incompatibilidad. Evita recomendar, por ejemplo, una oferta sin tecnologías solo por coincidir la ubicación;
* **la coincidencia de tecnologías es menor a 40** (mínimo técnico). En ofertas reales, los criterios que rara vez restringen (remoto, "no exige experiencia") aportan una parte grande del puntaje aunque no haya afinidad técnica. Sin este mínimo, ofertas con casi ninguna tecnología en común alcanzarían MEDIUM.

* **la modalidad es incompatible** (mínimo 50 para modalidad): una oferta presencial o híbrida en otra región o país no se recomienda, porque el candidato no podría asistir. Las ofertas remotas no se ven afectadas.

## Recomendaciones

Solo:

```text
MEDIUM
HIGH
```

de ofertas activas, ordenadas:

```text
score DESC
```

El score numérico es interno: se usa para clasificar y ordenar, y se guarda para análisis, pero la API no lo expone. El usuario ve el nivel de compatibilidad.

## Razones

El motor genera una razón por criterio, con estado `positive`, `negative` o `neutral`:

* `positive`: score ≥ 75;
* `negative`: score < 50;
* `neutral`: valores intermedios, requisitos no exigidos o criterios no evaluables.

Ejemplo:

```json
{
  "criterion": "skills",
  "status": "positive",
  "message": "Coinciden 4 de 5 tecnologías requeridas (Java, Spring, SQL, Docker); faltan: Kubernetes"
}
```

Ejemplo negativo:

```json
{
  "criterion": "experience",
  "status": "negative",
  "message": "La oferta requiere 3 años y el CV indica 1 año"
}
```

El texto de cada razón es el mismo que produce el cálculo del criterio: nunca se redacta después.

## Determinismo

La misma entrada + misma configuración debe producir:

```text
mismo score
mismo nivel
mismas razones
```

## Tests mínimos

* match perfecto;
* match alto;
* match medio;
* match bajo;
* skills parciales;
* skills obligatorias y deseables;
* aliases;
* experiencia superior;
* experiencia inferior;
* seniority compatible e incompatible;
* sin idiomas;
* sin educación;
* educación afín a informática, de otra área, terciaria y secundaria sin requisito en la oferta;
* área afín cuando la oferta pide una carrera de informática;
* prioridad de pesos (tecnologías > seniority > experiencia > resto);
* seniority desconocido;
* información incompleta (redistribución de pesos);
* oferta remota;
* modalidad incompatible;
* oferta sin tecnologías;
* coincidencia técnica bajo el mínimo;
* modalidad presencial/híbrida en otra región o país (excluida) y remota en otro país (recomendable);
* oferta sin requisitos;
* determinismo.
