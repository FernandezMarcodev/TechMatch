# Despliegue

**Objetivo:** publicar TechMatch **sin costo**, sin cambiar la arquitectura, y poder seguir sumando funcionalidades después. Las condiciones de los planes gratuitos cambian: verificarlas en los enlaces del final antes de empezar.

## Arquitectura gratuita

| Pieza | Servicio | Plan |
| --- | --- | --- |
| Backend (API) **y** frontend | [Render](https://render.com), un web service | Free |
| PostgreSQL | [Neon](https://neon.com) | Free (0,5 GB) |
| Sincronización de ofertas cada 12 h | GitHub Actions programado | Gratis (repositorio público) |

```text
Navegador ──► https://techmatch.onrender.com
                 │
                 ▼
          Render (web service free)
          Express: /api/* → API
                   resto  → frontend compilado (frontend/dist)
                 │
                 ▼
          Neon (PostgreSQL free) ◄── GitHub Actions cada 12 h (sync-jobs)
```

* **Un solo servicio** sirve la API y el frontend (`FRONTEND_DIST_DIR`), así que hay una sola URL, el frontend sigue llamando a `/api` y no hace falta configurar CORS.
* **La base va en Neon** y no en Render, porque la PostgreSQL gratuita de Render se borra a los 30 días.
* **La sincronización corre en GitHub Actions** porque el servicio gratuito se duerme cuando no hay visitas y su scheduler interno dejaría de correr.

Configuración versionada en el repositorio:

* `render.yaml`: el servicio de Render (Blueprint).
* `.github/workflows/sync-jobs.yml`: la sincronización programada.

## Qué implica el plan gratuito

| Límite | Efecto en TechMatch |
| --- | --- |
| El servicio **se duerme** tras 15 minutos sin visitas y tarda alrededor de un minuto en despertar | La primera visita después de un rato tarda; las siguientes son normales. |
| 512 MB de RAM y 0,1 CPU | Suficiente para el uso de un proyecto personal. Procesar un CV tarda unos segundos más que en local. |
| Disco **efímero** | Los PDF subidos se borran al reiniciar o dormir. No afecta: el texto y el perfil quedan en la base y el PDF no se vuelve a leer. |
| 750 horas gratis por mes en Render | Alcanza para un servicio encendido todo el mes. |
| 0,5 GB en Neon | Alcanza para miles de ofertas y CVs procesados. |
| Una sola instancia | Coincide con el diseño actual: el procesamiento de CVs es en memoria (ver `13-DECISIONES-TECNICAS.md`). |

## Paso a paso (primera vez)

### Paso 0 — Limpiar Cloudflare

Eliminar los proyectos de Workers `techmatch` y `techmatchs` (o desconectarlos de GitHub), que hoy fallan en cada push. Ver "Proyectos existentes en Cloudflare" más abajo.

### Paso 1 — Base de datos en Neon

1. Crear una cuenta en <https://neon.com> (se puede entrar con GitHub, sin tarjeta).
2. Crear un proyecto llamado `techmatch`, con PostgreSQL 16 o superior y la región más cercana disponible.
3. En **Connect**, copiar la cadena de conexión. Tiene esta forma y debe terminar en `sslmode=require`:

   ```text
   postgresql://usuario:contraseña@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```

Guardarla en un lugar seguro: es la contraseña de la base. No se commitea nunca.

### Paso 2 — Secreto en GitHub (para la sincronización)

En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**.

* Nombre: `PRODUCTION_DATABASE_URL`
* Valor: la cadena de conexión de Neon.

### Paso 3 — Servicio en Render

1. Crear una cuenta en <https://render.com> entrando con GitHub.
2. **New → Blueprint**, elegir el repositorio `TechMatch`. Render lee `render.yaml`.
3. Cuando pida `DATABASE_URL`, pegar la cadena de conexión de Neon.
4. **Apply**. El primer despliegue tarda unos minutos: instala, compila backend y frontend, aplica las migraciones y arranca.
5. Al terminar, Render muestra la URL pública, por ejemplo `https://techmatch.onrender.com`.

### Paso 4 — Cargar las ofertas

Con la base ya creada por el paso 3, en GitHub: **Actions → Sync jobs → Run workflow**. A partir de ahí se repite sola cada 12 horas.

### Paso 5 — Verificar

* `https://<tu-url>/api/health` responde `{"data":{"status":"ok"}}`.
* Abrir `https://<tu-url>`, subir un CV y recorrer: recomendaciones → detalle → adaptar CV → descargar PDF.

## Día a día

* **Desplegar:** automático. Cada push a `main` dispara el CI y, si pasa, Render despliega (`autoDeployTrigger: checksPass`). El flujo de trabajo no cambia: rama, `npm run ci`, merge a `main`, push.
* **Migraciones:** se aplican solas al arrancar el servicio (son idempotentes).
* **Ver errores:** Render → servicio `techmatch` → **Logs**.
* **Forzar una sincronización:** Actions → Sync jobs → Run workflow.

## Probar el modo producción en local

```bash
npm run build
NODE_ENV=production PORT=3400 FRONTEND_DIST_DIR=frontend/dist JOB_SYNC_ENABLED=false \
DATABASE_URL=postgres://techmatch:techmatch@localhost:5434/techmatch \
sh -c 'node backend/dist/main/migrate.js && node backend/dist/main/server.js'
```

Abrir <http://localhost:3400>: es la misma app que sirve Render.

## Más adelante

Cuando haya presupuesto o más uso, cada pieza se puede reemplazar sin tocar la arquitectura:

* **Plan pago de Render** (sin dormir, más recursos), con el mismo `render.yaml` cambiando `plan`.
* **Cloudflare** con Workers + Containers (requiere el plan Workers Paid): el frontend como Static Assets de un Worker y el backend sin cambios dentro de un contenedor. Se necesitaría un `Dockerfile`, un Worker que rutee `/api/*` al contenedor y su `wrangler.jsonc`. El plan gratuito de Workers no alcanza para el backend: limita cada request a 10 ms de CPU, y procesar un CV y compararlo con cientos de ofertas lleva bastante más.
* **Almacenamiento de PDFs** (si se necesita conservarlos): implementar el puerto `FileStorage` sobre un servicio de objetos (por ejemplo, Cloudflare R2).

## Proyectos existentes en Cloudflare

Hay dos proyectos de **Workers Builds** (`techmatch` y `techmatchs`) conectados al repositorio que fallan en cada push, porque intentan construirlo como un Worker. Para eliminarlos: en el panel de Cloudflare, **Workers & Pages** → proyecto → **Settings** → **Delete**. Para solo desconectarlos: **Settings → Build → Disconnect**. También se puede quitar el acceso de la app "Cloudflare Workers and Pages" al repositorio desde GitHub: **Settings → Applications → Installed GitHub Apps**.

## Referencias

* [Render: instancias gratuitas](https://render.com/docs/free)
* [Render: especificación de Blueprints (`render.yaml`)](https://render.com/docs/blueprint-spec)
* [Neon: precios y plan gratuito](https://neon.com/pricing)
* [Cloudflare Workers: precios y límites](https://developers.cloudflare.com/workers/platform/pricing/)
* [Cloudflare Containers: primeros pasos](https://developers.cloudflare.com/containers/get-started)
