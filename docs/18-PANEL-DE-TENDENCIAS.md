# Panel de tendencias

**Versión:** v2.2 (ver `14-PLAN-DE-DESARROLLO.md`, ticket 26); gráficos y métricas nuevas en v2.3 (ticket 28).

## Objetivo

Mostrar qué está pidiendo el mercado tech, a partir de las ofertas activas que TechMatch ya tiene en su base: qué tecnologías se piden más, qué seniority, qué modalidad y de qué fuentes y empresas vienen.

## Reglas

* **Público:** no requiere cuenta. Son métricas de ofertas; no incluye ningún dato de usuarios ni de CVs.
* **Solo ofertas activas**, de todas las fuentes.
* **Determinístico y explicable:** cada número es un conteo o un promedio directo sobre la base, sin estimaciones.
* **Agregaciones en SQL** (decisión en `13-DECISIONES-TECNICAS.md`): `COUNT`, `AVG` y `GROUP BY` sobre `job_offers` y `job_skills`. Sin servicios ni lenguajes adicionales.
* **Caché en memoria** de `STATS_CACHE_MINUTES` (60 por defecto): las ofertas cambian cada 12 h, así que no hace falta recalcular en cada visita. Los tamaños de las listas son configurables: `STATS_TOP_SKILLS` y `STATS_TOP_COMPANIES` (12 cada una, así las dos tarjetas quedan de la misma altura).
* **Capas:** `StatsService` (aplicación: porcentajes y caché) usa el puerto `OfferStatsRepository`, implementado en `persistence/pg-offer-stats-repository.ts` con seis consultas de agregación que corren en paralelo. El área de cada tecnología sale del catálogo de skills (`domain/normalization/skill-catalog.ts`), así que la agrupación por área se hace en `StatsService`, no en SQL.

## Métricas

| Métrica | Cálculo |
| --- | --- |
| Ofertas activas | Cantidad de ofertas activas |
| Empresas | Empresas distintas con ofertas activas |
| % remotas | Ofertas `REMOTE` sobre el total |
| % piden inglés | Ofertas con algún requisito de inglés sobre el total |
| Tecnologías más pedidas | Las 12 skills requeridas que más aparecen (cantidad y % de ofertas) |
| Tecnologías por área | Menciones de skills requeridas agrupadas por área del catálogo (Lenguajes, Frontend, Backend, Datos, Cloud y DevOps, Metodologías y herramientas), con % sobre el total de menciones reconocidas. Las skills fuera del catálogo (etiquetas genéricas como "Software Architecture") no tienen área y no se cuentan |
| Seniority | Ofertas por nivel (sin `UNKNOWN`), años de experiencia mínimos promedio y % de ofertas del nivel que piden inglés |
| Modalidad | Ofertas por modalidad. Incluye ofertas de otros países: la mayoría de las híbridas y presenciales son de Chile (Get on Board es una bolsa chilena) y el matching no las recomienda a un CV argentino |
| Fuentes | Ofertas por fuente |
| Empresas que más publican | Las 12 con más ofertas activas |

## API

`GET /api/stats/offers` (público):

```json
{
  "data": {
    "generatedAt": "2026-10-14T12:00:00.000Z",
    "totals": { "offers": 295, "companies": 101, "remotePercent": 53, "englishPercent": 41 },
    "topSkills": [{ "name": "React", "count": 122, "percent": 41 }],
    "skillAreas": [{ "area": "BACKEND", "count": 588, "percent": 24 }],
    "seniority": [
      { "level": "SENIOR", "count": 166, "avgExperienceYears": 4.8, "englishPercent": 30 }
    ],
    "modality": [{ "modality": "REMOTE", "count": 155 }],
    "sources": [{ "source": "getonboard", "count": 280 }],
    "topCompanies": [{ "name": "Empresa X", "count": 12 }]
  }
}
```

Los porcentajes son enteros redondeados; `avgExperienceYears` tiene un decimal o es `null` si ninguna oferta del nivel indica años.

## Frontend

* Página `/tendencias`, enlazada desde la barra superior ("Tendencias"; en el celular, solo el ícono).
* Gráficos hechos con CSS, sin librería (`components/Charts.tsx`); un tipo de gráfico según el dato:

  | Dato | Gráfico | Por qué |
  | --- | --- | --- |
  | Tecnologías y empresas | Ranking: barras horizontales azules, numeradas (los tres primeros destacados) | Mejor lectura para listas ordenadas con nombres largos |
  | Tecnologías por área y modalidad | Anillo (`conic-gradient`) con el total en el centro | Son partes de un total |
  | Seniority | Columnas verticales de Trainee a Manager, con años promedio e inglés debajo | Es una escala ordenada |
  | Fuentes | Una barra apilada al 100 % | Pocas partes; ocupa poco |

* Las formas son decorativas (`aria-hidden`): cada valor también está escrito como texto en la leyenda o junto a su etiqueta.
* Paleta clásica y lisa (sin degradés) en `styles/tokens.css` (`--chart-*`): azul, verde, rojo, amarillo, naranja y violeta. Cada categoría mantiene su color (remoto verde, híbrido amarillo, presencial azul); los colores están en `components/labels.ts`. Como cada valor también está escrito, ninguna información depende solo del color.
* Cada sección tiene un ícono propio (procesador, edificio, gráfico de torta, monitor, barras, capas) en blanco sobre un cuadrado de color liso, dibujado en `components/Icon.tsx` (sin librería de íconos).
* Distribución: números destacados (con un borde de color cada uno); los dos rankings lado a lado; los dos anillos lado a lado; seniority y fuentes a lo ancho. En el celular, una columna.
* Textos en español; los niveles y modalidades usan las mismas etiquetas que el resto de la app.

## "Qué te falta"

En la página de recomendaciones, una tarjeta muestra las tecnologías que más exigen las ofertas activas y que no encontramos en el CV, con el % de ofertas que piden cada una (`GET /api/cvs/{cvId}/missing-skills`, ver `04-API-CONTRACTS.md`).

* Reusa las agregaciones del panel: `StatsService.requiredSkills()` (misma caché) implementa el puerto `SkillDemand`, y `QueryService.getMissingSkills` resta las tecnologías del perfil.
* Solo tecnologías del catálogo, por la misma razón que el matching (`03-MATCHING-SPEC.md` § Skills).
* Es una sugerencia ("Si ya las manejás, sumalas a tu CV"): nunca agrega nada al CV. Si no hay nada que mostrar o falla la consulta, la tarjeta no aparece.
