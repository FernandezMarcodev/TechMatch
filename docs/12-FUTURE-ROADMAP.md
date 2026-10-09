# Roadmap futuro

Estas funcionalidades están fuera del MVP (`v1.0.0`). Las que ya tienen versión y rama asignadas están detalladas en `14-PLAN-DE-DESARROLLO.md`.

## Planificado

### v2.0 — CV adaptado a una oferta

Cuando exista un match MEDIUM o HIGH:

```text
Match
 ↓
Adaptar CV
 ↓
Analizar requisitos
 ↓
Proponer modificaciones (sin inventar)
 ↓
Generar CV (formato Harvard)
 ↓
Editar
 ↓
Recalcular compatibilidad
 ↓
Exportar PDF
```

### v2.1 — Usuarios (opcionales)

* Registro.
* Login.
* Autenticación.
* Historial de CVs.
* CVs adaptados guardados.
* Borrado de datos y de la cuenta.

### v2.2 — Extras

* Opción "disponible para mudarme" y modalidad preferida.
* Recalcular recomendaciones cuando se sincronizan ofertas nuevas.
* Recuperación de contraseña por email.

## Próximos pasos posibles

### Más fuentes y ofertas

* Nuevos conectores a fuentes con API pública o feed autorizado, priorizando ofertas con sede en Argentina (por ejemplo, las páginas de empleo públicas de empresas que usan Greenhouse, Lever o Workable).
* Acuerdos de acceso con portales que hoy no habilitan acceso automatizado.
* OCR para CVs escaneados.

### Cuentas

* Login con Google.
* Verificación de email.

### IA asistiva

La IA podría utilizarse para:

* sugerir redacciones;
* detectar skills;
* resumir ofertas;
* sugerir mejoras;
* adaptar el lenguaje del CV.

Siempre como propuesta que el usuario acepta o rechaza. La IA no sustituye el motor determinístico de matching.

### Empresas

* El matching inverso: de una oferta a los candidatos compatibles, con consentimiento del candidato.
