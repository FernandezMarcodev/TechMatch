# Adaptación de CV a una oferta

**Versión:** v2.0 (ver `14-PLAN-DE-DESARROLLO.md`).

## Objetivo

A partir de un CV procesado y una oferta recomendada, generar un **borrador de CV adaptado** a esa oferta, que el usuario pueda **editar**, **recalcular** contra la oferta y **exportar a PDF** en formato Harvard.

## Regla fundamental

> **Adaptar no es inventar.**

El borrador solo **reordena, destaca y redacta** información que el CV ya contiene. Lo que la oferta pide y el CV no tiene se muestra como **sugerencia** y nunca se agrega automáticamente. Si el usuario decide agregar algo al editar, es su decisión, y la interfaz le recuerda incluir solo lo que realmente sabe.

## Flujo

```text
Recomendación (MEDIUM/HIGH) o detalle de la oferta
 ↓
"Adaptar mi CV a esta oferta"
 ↓
Borrador adaptado + sugerencias        (GET, backend)
 ↓
Edición por secciones + vista previa Harvard   (frontend)
 ↓
"¿Cómo queda con esta oferta?"         (POST, backend: mismo motor de matching)
 ↓
Descargar PDF                          (frontend: CSS de impresión)
```

## Reglas del borrador

El borrador se genera de forma **determinística** a partir del `CandidateProfile` y del `JobOffer`, sin IA.

### Datos personales

* Nombre, email, teléfono y links quedan **vacíos** para que los complete el usuario: TechMatch no los extrae ni los guarda.
* Ubicación: la del perfil, si existe.
* Título profesional: el puesto de la experiencia más reciente, si existe.

### Resumen

Generado por plantilla con datos reales del perfil. Se omite cada parte cuyo dato falte:

```text
{Título} {Seniority} con {N} años de experiencia en {hasta 4 tecnologías coincidentes con la oferta}.
```

Ejemplo: "Desarrolladora Backend Semi Senior con 7 años de experiencia en Java, Spring Boot, PostgreSQL y Docker."

Nunca menciona tecnologías que el CV no tiene.

### Tecnologías

Orden:

1. coincidentes con las **obligatorias** de la oferta;
2. coincidentes con las **deseables**;
3. el resto, alfabéticamente.

Las coincidentes se marcan como destacadas en la vista previa.

### Experiencia

* Se mantiene el orden cronológico inverso (lo esperado en formato Harvard).
* Cada experiencia con tecnologías de la oferta se marca como **relevante**.
* Las líneas de descripción se convierten en viñetas; las que mencionan tecnologías de la oferta van primero.

### Proyectos

* Los proyectos personales o académicos del CV se incluyen siempre.
* Primero los que mencionan tecnologías de la oferta (marcados como **relevantes**); el resto, en el orden del CV.
* Fechas solo con año, como en educación: muchos CV fechan los proyectos por año y no se inventa un mes.
* Las viñetas se ordenan igual que en experiencia.

### Educación e idiomas

Tal como se extrajeron del CV.

### Sugerencias

Se generan a partir de los criterios del matching, nunca se agregan al CV:

| Tipo | Ejemplo |
| --- | --- |
| Tecnología obligatoria faltante | "La oferta pide Kubernetes. Si tenés experiencia, agregala." |
| Tecnología deseable faltante | "Suma conocer TypeScript (deseable)." |
| Idioma requerido no mencionado o con nivel menor | "La oferta pide inglés B2. Si tu nivel es ese o mayor, indicalo." |
| Experiencia menor a la pedida | "La oferta pide 5 años; tu CV indica 3. Destacá proyectos relevantes." |
| Dato no detectado en el CV | "No pudimos detectar tu seniority. Indicalo en el título." |

## Edición

* Secciones editables, en el orden de la vista previa: datos personales, resumen, educación, experiencia, proyectos (agregar, quitar, editar viñetas), tecnologías e idiomas (de A1 a C2 o nativo).
* Las sugerencias de tecnologías tienen la acción "La tengo, agregar", que solo se aplica con la confirmación del usuario.
* Vista previa en formato Harvard actualizada en vivo, como una **hoja A4 real**: mismo ancho, márgenes y tamaños de letra en puntos que el PDF, así los renglones cortan igual. La hoja se escala para entrar en la columna y se divide en **hojas separadas** donde la impresión corta las páginas (mismas reglas: una entrada o un párrafo no se parte y un título no queda solo al final), e indica cuántas páginas ocupa. El espacio entre hojas existe solo en pantalla; al imprimir, cada página empieza con un salto forzado en el mismo bloque. "Ampliar" la muestra a tamaño real.
* El borrador editado se guarda en el **navegador** (`localStorage`, por CV y oferta) para no perderlo al recargar. En v2.0 no se guarda en el servidor; guardar en la cuenta llega en v2.1.

## Recalcular la compatibilidad

* El CV editado se envía al backend **sin datos personales** (nombre, email, teléfono y links no salen del navegador).
* El backend lo convierte en un `CandidateProfile` con la misma normalización de siempre (aliases, niveles, fechas → años, seniority y nivel educativo por palabras clave) y lo evalúa con **el mismo motor de matching**, sin modificarlo.
* Respuesta: nivel y razones, igual que una recomendación (sin score numérico).
* La interfaz compara con el nivel original: "Antes: Compatibilidad media → Ahora: Alta compatibilidad".
* No se guarda nada en el servidor.

## Formato Harvard (vista previa y PDF)

Sigue la plantilla de CV de Harvard (Office of Career Services):

* Una columna, tamaño A4, tipografía serif, márgenes amplios.
* Encabezado: nombre centrado y una línea con ubicación, email, teléfono y links separados por "•".
* Secciones en este orden: Perfil (opcional), Educación, Experiencia, Proyectos y Habilidades (tecnologías e idiomas). El perfil no forma parte de la plantilla original; se mantiene porque es el resumen adaptado a la oferta, y si se deja vacío no aparece.
* Títulos de sección en versalitas con una línea divisoria.
* Cada entrada: institución, empresa o proyecto en negrita; título o puesto en cursiva; fechas alineadas a la derecha; viñetas debajo, una por logro (una frase por viñeta, aunque ocupe varios renglones).
* Habilidades: "Tecnologías:" e "Idiomas:" como listas separadas por comas.
* Exportación: botón "Descargar PDF" que imprime solo la vista previa (CSS `@media print`), con el nombre sugerido `CV - {Nombre} - {Empresa}.pdf`. La página de impresión no tiene márgenes propios (`@page { margin: 0 }`; los márgenes son el relleno de la hoja), así el navegador no agrega encabezado ni pie con la fecha, el título de la pestaña o la URL.

## API

### GET /api/cvs/{cvId}/adaptations/{jobId}

Genera el borrador.

```json
{
  "data": {
    "job": { "id": "…", "title": "Backend Developer", "company": "Empresa X" },
    "document": {
      "personal": {
        "fullName": "",
        "headline": "Desarrolladora Backend",
        "email": "",
        "phone": "",
        "location": "Capital Federal, Buenos Aires",
        "links": []
      },
      "summary": "Desarrolladora Backend Semi Senior con 7 años de experiencia en Java, Spring Boot y PostgreSQL.",
      "experiences": [
        {
          "position": "Desarrolladora Backend Semi Senior",
          "company": "Acme S.A.",
          "startDate": "2021-03",
          "endDate": null,
          "highlights": ["Desarrollo de microservicios con Java, Spring Boot y PostgreSQL."],
          "relevant": true
        }
      ],
      "education": [
        {
          "degree": "Ingeniería en Sistemas de Información",
          "institution": "Universidad Tecnológica Nacional",
          "startDate": "2013",
          "endDate": "2019"
        }
      ],
      "projects": [
        {
          "name": "TechMatch - Plataforma de búsqueda de empleo",
          "startDate": "2024",
          "endDate": null,
          "highlights": ["API REST con Node.js y PostgreSQL."],
          "relevant": true
        }
      ],
      "skills": [
        { "name": "Java", "highlighted": true },
        { "name": "Git", "highlighted": false }
      ],
      "languages": [{ "name": "Inglés", "level": "C1" }]
    },
    "suggestions": [
      {
        "type": "MISSING_REQUIRED_SKILL",
        "skill": "Kubernetes",
        "message": "La oferta pide Kubernetes. Si tenés experiencia, agregala."
      }
    ]
  }
}
```

* Fechas como texto `YYYY-MM` o `YYYY`; `endDate: null` significa "Actualidad".
* Tipos de sugerencia: `MISSING_REQUIRED_SKILL`, `MISSING_OPTIONAL_SKILL`, `LANGUAGE`, `EXPERIENCE`, `MISSING_DATA`.

### POST /api/cvs/{cvId}/adaptations/{jobId}/evaluation

Evalúa el CV editado contra la oferta.

Request: el `document` sin `personal.fullName`, `personal.email`, `personal.phone` ni `personal.links`.

```json
{
  "data": {
    "original": { "level": "MEDIUM" },
    "adapted": {
      "level": "HIGH",
      "reasons": [{ "criterion": "skills", "status": "positive", "message": "…" }]
    }
  }
}
```

### Errores

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `CV_NOT_FOUND` | 404 | CV inexistente |
| `JOB_NOT_FOUND` | 404 | oferta inexistente |
| `CV_NOT_PROCESSED` | 409 | el CV todavía no terminó de procesarse o falló |
| `INVALID_CV_DOCUMENT` | 400 | el documento enviado no cumple el formato o los límites |

Límites del documento: hasta 30 experiencias, 15 viñetas por experiencia, 100 tecnologías, 20 educaciones y 15 idiomas; textos de hasta 2.000 caracteres.

## Arquitectura

* `backend/src/cv-adaptation/`: generación del borrador y conversión documento → `CandidateProfile`. Funciones puras, testeadas sin base de datos.
* `application/`: caso de uso que carga perfil y oferta, genera el borrador y evalúa con `evaluateMatch`.
* Frontend: página `/cv/:cvId/adaptar/:jobId` con editor, sugerencias, recálculo y vista previa imprimible.

## Tests mínimos

* El borrador no contiene tecnologías, idiomas ni experiencias ausentes en el CV.
* Orden de tecnologías: obligatorias coincidentes, deseables coincidentes, resto.
* Experiencias relevantes marcadas y viñetas coincidentes primero.
* Resumen sin partes inventadas cuando faltan datos (sin seniority, sin años, sin coincidencias).
* Sugerencias por cada tipo.
* Ida y vuelta: perfil → documento → perfil conserva tecnologías, seniority, años, educación e idiomas.
* Recalcular con el documento sin cambios da el mismo nivel que la recomendación original.
* Agregar una tecnología faltante en el documento mejora el criterio de tecnologías.
* Validación del documento (formato y límites).
* E2E: recomendación → adaptar → editar → recalcular → vista de impresión.

## Fuera de alcance (v2.0)

* Guardar el CV adaptado en el servidor (v2.1, con cuentas).
* Uso de IA para redactar.
* Más de una plantilla o exportación a Word.
