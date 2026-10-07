# Criterios de aceptación

## CA-001 — PDF válido

**Dado:** un usuario carga un PDF válido.
**Cuando:** se procesa.
**Entonces:** el sistema acepta el archivo.

## CA-002 — Archivo inválido

**Dado:** un usuario carga un archivo que no es PDF, aunque se declare como PDF.
**Entonces:** el backend lo rechaza con `INVALID_FILE`.

## CA-003 — Procesamiento

**Dado:** un CV legible.
**Entonces:** el sistema genera un perfil estructurado.

## CA-004 — No invención

**Dado:** un dato no aparece en el CV.
**Entonces:** el sistema no debe inventarlo.

## CA-005 — Score

**Dado:** un CV y una oferta.
**Entonces:** el motor genera score entre 0 y 100.

## CA-006 — Determinismo

La misma entrada debe producir exactamente el mismo resultado.

## CA-007 — LOW

Un match LOW nunca aparece en recomendaciones.

## CA-008 — MEDIUM/HIGH

Un match MEDIUM o HIGH puede aparecer.

## CA-009 — Orden

Las recomendaciones aparecen de mayor a menor score.

## CA-010 — Explicación

Cada recomendación contiene razones derivadas del matching.

## CA-011 — URL

La oferta mantiene su URL de origen.

## CA-012 — Fuente

La oferta mantiene su fuente y la interfaz la indica.

## CA-013 — Duplicados

La misma oferta no genera múltiples registros, aunque aparezca en varias categorías o sincronizaciones.

## CA-014 — Fuente no disponible

Si una fuente rechaza el acceso o falla, las demás continúan y no se desactivan ofertas existentes.

## CA-015 — Inactividad

Una oferta que deja de publicarse se marca como inactiva y no se recomienda.

## CA-016 — Nuevo CV

El usuario puede cargar un segundo CV.

## CA-017 — Flujo completo

Debe poder completarse:

```text
Upload
→ Processing
→ Recommendations
→ Job Detail
→ Oferta original
```

sin autenticación.

## CA-018 — Mínimo técnico

Una oferta cuya coincidencia de tecnologías es menor al mínimo configurado no se recomienda.

## CA-019 — Filtros

Filtrar por nivel o por modalidad remota reduce la lista sin alterar el orden por score.

## CA-020 — Interfaz

La interfaz sigue Material Design 3, se adapta a móvil y escritorio, y respeta el modo claro u oscuro del sistema.

## CA-021 — Sin scraping

Las ofertas se obtienen únicamente de interfaces públicas de las fuentes; ninguna solicitud evade bloqueos.

## CA-022 — Modalidad incompatible

Una oferta presencial o híbrida en otra región o país que la del candidato no se recomienda; una remota sí puede recomendarse.

## CA-023 — Score interno

Ni la API ni la interfaz muestran el score numérico; el usuario ve el nivel de compatibilidad.
