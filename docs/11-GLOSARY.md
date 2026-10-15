# Glosario

| Término                  | Definición                                                                        |
| ------------------------ | --------------------------------------------------------------------------------- |
| **TechMatch**            | Sistema que compara CVs con ofertas laborales de tecnología.                      |
| **CV**                   | Currículum vitae cargado por el usuario.                                          |
| **CandidateProfile**     | Información estructurada obtenida del CV.                                         |
| **JobOffer**             | Oferta laboral normalizada.                                                       |
| **Skill**                | Habilidad o competencia.                                                          |
| **Tecnología**           | Lenguaje, framework, herramienta o tecnología requerida o mencionada.             |
| **Tecnología deseable**  | Tecnología que la oferta valora pero no exige; pesa la mitad que una obligatoria. |
| **Seniority**            | Nivel profesional del candidato o requerido por una oferta.                       |
| **Matching**             | Proceso de comparar un CV con una oferta.                                         |
| **Score**                | Puntaje de compatibilidad de 0 a 100.                                             |
| **LOW**                  | Compatibilidad baja; no se recomienda.                                            |
| **MEDIUM**               | Compatibilidad media; puede recomendarse.                                         |
| **HIGH**                 | Compatibilidad alta; puede recomendarse.                                          |
| **Mínimo técnico**       | Coincidencia de tecnologías por debajo de la cual una oferta no se recomienda.    |
| **Fuente**               | Origen de una oferta: Get on Board o la página de empleos de una empresa en Lever o Greenhouse. |
| **Conector**             | Componente que obtiene ofertas desde la interfaz pública (API) de una fuente.     |
| **Sincronización**       | Ejecución periódica que obtiene, normaliza y guarda las ofertas de las fuentes.   |
| **Normalización**        | Transformación de datos diferentes a una representación común.                    |
| **Deduplicación**        | Detección y prevención de registros duplicados.                                   |
| **Oferta activa**        | Oferta actualmente considerada disponible.                                        |
| **Oferta inactiva**      | Oferta que dejó de publicarse en su fuente.                                       |
| **OCR**                  | Reconocimiento óptico de caracteres.                                              |
| **MVP**                  | Minimum Viable Product.                                                           |
| **DTO**                  | Data Transfer Object utilizado en las interfaces de la aplicación.                |
| **Alias**                | Nombre alternativo de una misma skill o tecnología.                               |
| **UNKNOWN**              | Información que no pudo determinarse.                                             |
| **Material Design 3**    | Sistema de diseño de Google en el que se basa la interfaz.                        |
| **ATS**                  | Sistema de selección que usan las empresas (Lever, Greenhouse) y que publica su página de empleos con una API pública. |
| **Catálogo de skills**   | Lista de tecnologías conocidas con sus alias y su área. Solo estas se comparan en el matching. |
| **Área**                 | Grupo de una tecnología del catálogo: lenguajes, frontend, backend, datos, cloud y DevOps, metodologías y herramientas. |
| **Estado de una razón**  | `positive` (se cumple), `partial` (en parte), `negative` (no se cumple), `neutral` (no exigido o no evaluable). |
| **Recálculo**            | Volver a calcular las recomendaciones de todos los CVs analizados después de sincronizar ofertas. |
| **Visitante**            | Persona que usa TechMatch sin cuenta.                                             |
| **Cuenta**               | Registro opcional con email y contraseña que da privilegios.                       |
| **Privilegio**           | Función exclusiva de la cuenta (todas las recomendaciones, adaptar el CV, guardar CVs), controlada en la API. |
| **Sesión**               | Token aleatorio que identifica al usuario; se manda en `Authorization: Bearer` y la base guarda solo su hash. |
| **CV guardado**          | CV que el usuario eligió guardar en su cuenta; solo lo ve su dueño y no vence.     |
| **CV adaptado**          | Borrador del CV reordenado para una oferta, sin datos inventados, editable y exportable a PDF. |
| **Formato Harvard**      | Plantilla de CV de una columna usada para la vista previa y el PDF.                |
| **Panel de tendencias**  | Página pública con métricas agregadas de las ofertas activas.                      |
| **Qué te falta**         | Tecnologías más pedidas por las ofertas que el CV no tiene.                        |
