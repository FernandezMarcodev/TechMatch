# Roadmap futuro

Lo ya implementado y lo planificado con versión y rama están en `14-PLAN-DE-DESARROLLO.md`. Este documento reúne ideas sin versión asignada.

## Implementado después del MVP

* **v2.0:** CV adaptado a una oferta (borrador sin inventar, editor, formato Harvard, recálculo, PDF).
* **v2.1:** cuentas opcionales con privilegios (verificación de email, recuperación de contraseña, CVs guardados, borrado de la cuenta).
* **v2.2:** fuentes Lever y Greenhouse, panel de tendencias, recálculo de recomendaciones después de cada sincronización.
* **v2.3:** gráficos propios, tecnologías por área, "Qué te falta", estado parcial en las razones.

## Planificado (v2.4)

* Guardar y reabrir CVs adaptados (usuarios con cuenta).
* Preferencias del candidato: "disponible para mudarme" y modalidad preferida, como entradas del matching.

## Próximos pasos posibles

### Más fuentes y ofertas

* Más empresas en `LEVER_COMPANIES` y `GREENHOUSE_COMPANIES` (sumar una es cambiar una variable de entorno).
* Otros ATS con API pública (Ashby, Workable) cuando haya empresas argentinas que los usen.
* Fuentes remotas globales (Himalayas, RemoteOK, Arbeitnow) con filtro de ubicación, revisando sus términos.
* Acuerdos de acceso con portales que hoy no habilitan acceso automatizado.
* OCR para CVs escaneados.

### Tendencias

* Desglose por país (Argentina, Chile, otros): la mayoría de las ofertas híbridas y presenciales son de otros países y no se recomiendan a un CV argentino.
* Evolución en el tiempo (requiere guardar fotos periódicas de las métricas).

### Cuentas

* Login con Google.
* Cookie `httpOnly` con un dominio propio, en lugar del token en `localStorage`.

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
