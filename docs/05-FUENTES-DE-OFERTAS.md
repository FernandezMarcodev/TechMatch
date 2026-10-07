# Fuentes de ofertas

## Objetivo

Obtener ofertas laborales de tecnología desde fuentes externas, transformarlas a un modelo común y mantenerlas actualizadas.

## Principio

TechMatch integra **solo fuentes que ofrecen una interfaz para acceso automatizado** (API pública o feed). No extrae datos de páginas web (scraping).

Motivos:

* los portales de empleo masivos de la región (Computrabajo, Zona Jobs, Bumeran) protegen sus sitios contra el acceso automatizado, y el proyecto no evade bloqueos ni controles de acceso;
* una API entrega datos estructurados (tecnologías, seniority, modalidad declarados por quien publica) que no hay que inferir de un texto;
* una API no se rompe con un rediseño visual del sitio.

## Fuente del MVP: Get on Board

* Bolsa de empleo tecnológico de Latinoamérica: <https://www.getonbrd.com>.
* API pública v0, sin clave de acceso.
* Endpoint utilizado:

```text
GET /api/v0/categories/{categoria}/jobs
    ?per_page={n}&page={p}
    &expand=["company","tags","seniority","location_cities"]
```

* Categorías por defecto: `programming`, `data-science-analytics`, `sysadmin-devops-qa`, `mobile-developer`, `machine-learning-ai`, `cybersecurity`.
* La interfaz indica "Ofertas provistas por Get on Board" y enlaza cada oferta original. Antes de producción deben revisarse los términos de uso de su API.

### Datos que aporta

| Campo de la API | Uso en TechMatch |
| --- | --- |
| `title` | título |
| `company.name` | empresa |
| `description` | requisitos (una línea por ítem) |
| `desirable` | conocimientos deseables |
| `projects`, `functions`, `benefits` | descripción |
| `tags` | tecnologías declaradas |
| `seniority.name` | seniority declarado |
| `remote_modality` | modalidad |
| `location_cities`, `countries` | ubicación |
| `published_at` | fecha de publicación |
| `links.public_url` | URL original |
| `id` | identificador externo |

### Traducciones específicas

* Modalidad: `fully_remote` y `remote_local` → remoto; `hybrid` → híbrido; `no_remote` → presencial.
* Seniority: "Sin experiencia" → Trainee; "Expert" → Lead; el resto se reconoce por nombre.
* Ubicación: ciudad y país de la oferta (por ejemplo "Santiago, Chile"); las ofertas remotas no tienen ubicación restrictiva.

## Arquitectura

Cada fuente implementa el mismo contrato:

```typescript
interface JobSourceConnector {
  source: JobSource;
  fetchOffers(): Promise<RawJobOffer[]>;
}
```

```text
JobSourceConnector
└── GetOnBoardConnector
```

Agregar una fuente implica un conector nuevo y su identificador en `JobSource`. El motor de matching, el procesamiento de CV, la API y el frontend no cambian.

## Pipeline

```text
API de la fuente
 ↓
Conector (HttpClient)
 ↓
RawJobOffer
 ↓
Normalizer
 ↓
Deduplicator
 ↓
Repository
 ↓
Database
```

## Cliente HTTP

* User-agent identificable (`TechMatchBot`).
* Timeout por request.
* Reintentos limitados con backoff exponencial ante errores transitorios (5xx, red).
* Espaciado mínimo entre requests.
* Una respuesta 401, 403 o 429 marca la fuente como **no disponible** y no se reintenta.

## Normalización

* Tecnologías: los tags declarados son **obligatorios**, salvo que la oferta los mencione solo como deseables. Una línea es deseable cuando:
  * proviene del campo `desirable`;
  * contiene un marcador ("deseable", "valorable", "plus", "nice to have"...);
  * está bajo un subtítulo deseable ("Conocimientos deseables") hasta el siguiente subtítulo.
* Además de los tags, se reconocen tecnologías del catálogo de aliases en el título, los requisitos y la descripción.
* Experiencia, educación e idiomas exigidos se leen de los **requisitos** cuando la fuente los separa. La descripción suele hablar de la empresa ("15 años de experiencia en el mercado") y no debe interpretarse como requisito.
* Seniority: primero el declarado, luego el título.
* Empresa ausente → "Empresa no especificada" (no se inventa).

## Deduplicación

Prioridad:

1. fuente + identificador externo;
2. URL;
3. fuente + título + empresa + ubicación.

Se aplica dentro de cada lote y contra la base de datos.

## Actualización

Si la oferta ya existe:

* actualizar información;
* actualizar `lastSeenAt`;
* marcar `isActive = true`.

## Inactividad

Las ofertas que no aparecen en una sincronización exitosa pasan a:

```text
isActive = false
```

Nunca se eliminan. Si vuelven a aparecer, se reactivan.

## Fallos

* Cada fuente se sincroniza de forma independiente.
* Una sincronización fallida o vacía **no** desactiva ofertas existentes.

## Frecuencia y límites

* Cada 12 horas (`JOB_SYNC_INTERVAL_HOURS`), dentro del backend (`JOB_SYNC_ENABLED`) o como proceso independiente (`npm run sync-jobs`).
* Máximo de ofertas por fuente configurable (`JOB_SYNC_MAX_OFFERS_PER_SOURCE`, 300 por defecto).

## Logs

Por fuente y sincronización:

* fuente;
* inicio;
* finalización;
* estado (`ok`, `unavailable`, `failed`);
* cantidad obtenida;
* insertadas;
* actualizadas;
* duplicadas;
* desactivadas;
* errores;
* duración.
