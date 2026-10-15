# Panel de tendencias

**Versión:** v2.2 (ver `14-PLAN-DE-DESARROLLO.md`, ticket 26).

## Objetivo

Mostrar qué está pidiendo el mercado tech, a partir de las ofertas activas que TechMatch ya tiene en su base: qué tecnologías se piden más, qué seniority, qué modalidad y de qué fuentes y empresas vienen.

## Reglas

* **Público:** no requiere cuenta. Son métricas de ofertas; no incluye ningún dato de usuarios ni de CVs.
* **Solo ofertas activas**, de todas las fuentes.
* **Determinístico y explicable:** cada número es un conteo o un promedio directo sobre la base, sin estimaciones.
* **Agregaciones en SQL** (decisión en `13-DECISIONES-TECNICAS.md`): `COUNT`, `AVG` y `GROUP BY` sobre `job_offers` y `job_skills`. Sin servicios ni lenguajes adicionales.
* **Caché en memoria** de `STATS_CACHE_MINUTES` (60 por defecto): las ofertas cambian cada 12 h, así que no hace falta recalcular en cada visita. Los tamaños de las listas son configurables: `STATS_TOP_SKILLS` y `STATS_TOP_COMPANIES` (12 cada una, así las dos tarjetas quedan de la misma altura).
* **Capas:** `StatsService` (aplicación: porcentajes y caché) usa el puerto `OfferStatsRepository`, implementado en `persistence/pg-offer-stats-repository.ts` con seis consultas de agregación que corren en paralelo.

## Métricas

| Métrica | Cálculo |
| --- | --- |
| Ofertas activas | Cantidad de ofertas activas |
| Empresas | Empresas distintas con ofertas activas |
| % remotas | Ofertas `REMOTE` sobre el total |
| % piden inglés | Ofertas con algún requisito de inglés sobre el total |
| Tecnologías más pedidas | Las 12 skills requeridas que más aparecen (cantidad y % de ofertas) |
| Seniority | Ofertas por nivel (sin `UNKNOWN`) y años de experiencia mínimos promedio de cada nivel |
| Modalidad | Ofertas por modalidad |
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
    "seniority": [{ "level": "SENIOR", "count": 166, "avgExperienceYears": 4.8 }],
    "modality": [{ "modality": "REMOTE", "count": 155 }],
    "sources": [{ "source": "getonboard", "count": 280 }],
    "topCompanies": [{ "name": "Empresa X", "count": 12 }]
  }
}
```

Los porcentajes son enteros redondeados; `avgExperienceYears` tiene un decimal o es `null` si ninguna oferta del nivel indica años.

## Frontend

* Página `/tendencias`, enlazada desde la barra superior ("Tendencias"; en el celular, solo el ícono).
* Números destacados (ofertas, empresas, % remotas, % piden inglés) y barras horizontales hechas con CSS: sin librería de gráficos.
* Distribución simétrica: una fila con los dos rankings de la misma altura (tecnologías y empresas) y otra con las tres distribuciones (seniority, modalidad y fuentes) en columnas iguales. En el celular, una columna.
* Textos en español; los niveles y modalidades usan las mismas etiquetas que el resto de la app.
