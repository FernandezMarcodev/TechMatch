# Procesamiento de CV

## Pipeline

```text
PDF
 ↓
Validación
 ↓
Compresión/optimización
 ↓
Extracción de texto
 ↓
OCR (fallback)
 ↓
Limpieza
 ↓
Segmentación
 ↓
Extracción estructurada
 ↓
Normalización
 ↓
CandidateProfile
```

## Carga y validación

Se ejecutan en la request de carga:

* tamaño dentro del límite configurado (`CV_MAX_SIZE_BYTES`, 5 MB por defecto);
* firma `%PDF-` en el contenido, sin confiar en el tipo MIME ni en la extensión declarados;
* apertura real del documento: un PDF dañado o protegido se rechaza con `PDF_NOT_PROCESSABLE`.

El archivo se guarda en un directorio privado, no servido por HTTP, con el nombre `<uuid>.pdf`. El nombre original solo se conserva saneado como dato descriptivo.

## Procesamiento asíncrono

Tras la carga, el CV queda en `PROCESSING` y se procesa en segundo plano dentro del backend. El cliente consulta `GET /api/cvs/{cvId}` hasta obtener `processed` o `failed`.

Al finalizar, se guarda el perfil y se calculan los resultados de matching contra las ofertas activas en ese momento.

Si el backend se reinicia mientras un CV se procesa, ese trabajo se pierde. Al iniciar, el backend marca como `FAILED` los CVs que quedaron en `UPLOADED` o `PROCESSING`, y el usuario ve el mensaje para cargarlo de nuevo. Esto supone una única instancia del backend; con varias, el procesamiento debería pasar a una cola persistente.

## Compresión/optimización

Paso previsto en el pipeline sin transformación en el MVP. Los archivos están limitados en tamaño y no se publican, así que recomprimirlos no aporta lo suficiente para justificar una dependencia adicional.

## Extracción

Se obtiene el texto nativo del PDF y se reconstruyen las líneas a partir de la posición de cada fragmento (de arriba hacia abajo y de izquierda a derecha). Dos fragmentos a menos de media altura de letra de distancia vertical forman la misma línea: las viñetas y los cambios de fuente suelen dibujarse unos puntos fuera de la línea base y no deben quedar en una línea aparte.

Si no hay texto útil (menos de `CV_MIN_TEXT_CHARS` letras y dígitos):

```text
PDF escaneado
      ↓
OCR (si está habilitado)
      ↓
texto
```

El OCR está definido como un puerto (`OcrProvider`) y deshabilitado en el MVP. Un PDF sin texto termina en `failed` con un mensaje claro para el usuario.

## Limpieza

* normalización Unicode;
* eliminación de caracteres de control;
* viñetas al inicio de línea (•, ▪, ➢, ✓, *, guiones y los símbolos privados que exporta Word para viñetas de Symbol/Wingdings), también cuando quedan solas en una línea;
* espacios múltiples;
* palabras cortadas con guion entre líneas ("desa-\nrrollo");
* frases partidas en varios renglones: una línea continúa la anterior cuando la anterior es larga (40 caracteres o más), no termina en puntuación de cierre y la nueva empieza en minúscula, o la anterior termina en coma o conector ("de", "con", "para", "y"…). Nunca se unen una línea con viñeta propia, un título de sección, un rango de fechas ni un dato de contacto. Así cada viñeta del CV adaptado es una sola frase.

## Segmentación

Se detectan secciones por títulos conocidos (en español e inglés):

* perfil / resumen;
* experiencia;
* educación / formación;
* habilidades / conocimientos;
* proyectos (proyectos personales, académicos, portfolio);
* idiomas;
* otras (cursos, contacto...).

Las líneas previas al primer título forman el encabezado.

## Datos

### Experiencia

* empresa;
* puesto;
* descripción;
* fechas;
* duración;
* tecnologías.

Cada línea con un rango de fechas ("Marzo 2021 - Actualidad", "01/2018 a 06/2019", "2013 - 2019") inicia una experiencia. Los años totales suman los períodos sin contar dos veces los solapamientos. Si no hay fechas, se usa una mención explícita ("4 años de experiencia").

### Educación

* institución;
* título;
* área;
* nivel (secundario, terciario, universitario, posgrado);
* fechas.

### Proyectos

* nombre;
* descripción (una viñeta por línea);
* fechas, si las hay en la línea del nombre o en la siguiente.

Un proyecto empieza en una línea corta que no es una oración (sin punto final, empieza con mayúscula o número) y que sigue a una oración terminada, tiene fechas o un separador ("TechMatch - Plataforma web"). Lo que sigue hasta el próximo nombre es su descripción. Los proyectos no suman años de experiencia laboral; sus tecnologías sí cuentan como skills del CV.

### Skills

Tecnologías del catálogo de aliases mencionadas en cualquier parte del CV.

### Idiomas

* idioma;
* nivel (CEFR o descriptor: básico, intermedio, avanzado, nativo).

### Información general

* seniority (palabras explícitas en el puesto más reciente o en el encabezado);
* ubicación (campo rotulado o ciudad/provincia reconocible en el encabezado);
* años de experiencia.

## Normalización

Ejemplos:

```text
JS       → JavaScript
TS       → TypeScript
Node     → Node.js
Postgres → PostgreSQL
Inglés   → English
avanzado → C1
```

## Incertidumbre

Si no puede determinarse:

```json
null
```

o:

```text
UNKNOWN
```

Nunca inventar. El seniority no se deduce de los años de experiencia.

## Resultado

```json
{
  "seniority": "SEMI_SENIOR",
  "totalExperienceYears": 7.1,
  "location": "Capital Federal, Buenos Aires",
  "skills": [
    "Java",
    "Spring Boot",
    "PostgreSQL"
  ],
  "languages": [
    {
      "name": "English",
      "level": "C1"
    }
  ],
  "experiences": [],
  "education": []
}
```

Este perfil es interno y no se muestra directamente al usuario en el MVP.

## Privacidad

* El contenido del CV nunca se registra en logs: solo metadatos (id, duración, cantidades).
* Los archivos no son accesibles públicamente.

## Estados

```text
UPLOADED
PROCESSING
PROCESSED
FAILED
```
