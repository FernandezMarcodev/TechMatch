# Despliegue

**Objetivo:** publicar TechMatch **sin costo**, sin cambiar la arquitectura, y poder seguir sumando funcionalidades después. Las condiciones de los planes gratuitos cambian: verificarlas en los enlaces del final antes de empezar.

## Arquitectura gratuita

| Pieza | Servicio | Plan |
| --- | --- | --- |
| Frontend (React compilado, estático) | [Cloudflare Pages](https://pages.cloudflare.com) | Free |
| Backend (API) | [Render](https://render.com), un web service | Free |
| PostgreSQL | [Neon](https://neon.com) | Free (0,5 GB) |
| Sincronización de ofertas cada 12 h | GitHub Actions programado | Gratis (repositorio público) |

```text
Navegador ──► https://techmatch.pages.dev          (Cloudflare Pages: HTML, JS, CSS)
    │
    └──── fetch ──► https://techmatch-api.onrender.com/api/*   (Render: Express)
                                   │
                                   ▼
                     Neon (PostgreSQL free) ◄── GitHub Actions cada 12 h (sync-jobs)
```

* **Frontend en Cloudflare Pages:** son archivos estáticos, así que se sirven desde la red de Cloudflare, rápido y sin dormirse. Las rutas de la app (`/cv/…`, `/ofertas/…`) funcionan porque Pages trata el sitio como una SPA cuando no hay un `404.html`: cualquier ruta desconocida devuelve `index.html`.
* **Backend en Render:** el plan gratuito de Cloudflare Workers no alcanza para la API (limita cada request a 10 ms de CPU, y procesar un CV lleva bastante más), y Render corre el mismo Express de local.
* **Dos dominios distintos:** el frontend llama a la API con su URL completa (`VITE_API_URL`, se fija al compilar) y el backend acepta ese origen por CORS (`CORS_ORIGIN`). Los datos personales del CV adaptado siguen sin salir del navegador.
* **La base va en Neon** y no en Render, porque la PostgreSQL gratuita de Render se borra a los 30 días.
* **La sincronización corre en GitHub Actions** porque el servicio gratuito de Render se duerme cuando no hay visitas y su scheduler interno dejaría de correr. Se conecta directo a Neon: no depende de que Render esté despierto.

Configuración versionada en el repositorio:

* `render.yaml`: los valores del servicio de Render (como referencia; el servicio se crea a mano).
* `frontend/.env.example` y `backend/.env.example`: variables de cada parte.
* `.github/workflows/sync-jobs.yml`: la sincronización programada.

## Qué implica el plan gratuito

| Límite | Efecto en TechMatch |
| --- | --- |
| Render **duerme** el servicio tras 15 minutos sin visitas y tarda alrededor de un minuto en despertar | El frontend carga al instante (está en Cloudflare). Apenas se abre la portada, el frontend llama a `/api/health` para ir despertando la API mientras el usuario elige su CV; aun así, la primera subida después de un rato puede tardar. |
| 512 MB de RAM y 0,1 CPU en Render | Suficiente para el uso de un proyecto personal. Procesar un CV tarda unos segundos más que en local. |
| Disco **efímero** en Render | Los PDF subidos se borran al reiniciar o dormir. No afecta: el texto y el perfil quedan en la base y el PDF no se vuelve a leer. |
| 750 horas gratis por mes en Render | Alcanza para un servicio encendido todo el mes. |
| Cloudflare Pages: 500 compilaciones por mes | Alcanza de sobra (una por push a `main`). |
| 0,5 GB en Neon | Alcanza para miles de ofertas y CVs procesados. |
| Una sola instancia | Coincide con el diseño actual: el procesamiento de CVs es en memoria (ver `13-DECISIONES-TECNICAS.md`). |

## Paso a paso (primera vez)

El orden importa: primero el backend (para tener su URL), después el frontend (que necesita esa URL al compilar) y por último se autoriza el dominio del frontend en el backend.

### Paso 0 — Limpiar Cloudflare

Si existen los proyectos de **Workers** `techmatch` y `techmatchs` conectados al repositorio, eliminarlos: intentan construir el repositorio como un Worker y fallan en cada push. En el panel: **Workers & Pages** → proyecto → **Settings** → **Delete**. El frontend va en un proyecto de **Pages** nuevo (paso 4), que es otra cosa.

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

### Paso 3 — Backend en Render (a mano, desde el panel)

1. Crear una cuenta en <https://render.com> entrando con GitHub.
2. **New → Web Service** → elegir el repositorio `TechMatch`.
3. Completar:

   | Campo | Valor |
   | --- | --- |
   | Name | `techmatch-api` (define la URL: `https://techmatch-api.onrender.com`) |
   | Language | Node |
   | Branch | `main` |
   | Root Directory | vacío (la raíz del repositorio) |
   | Build Command | `npm ci --include=dev && npm run build -w backend` |
   | Start Command | `node backend/dist/main/migrate.js && node backend/dist/main/server.js` |
   | Instance Type | Free |

4. En **Environment Variables**:

   | Variable | Valor |
   | --- | --- |
   | `NODE_VERSION` | `24` |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | la cadena de conexión de Neon |
   | `CORS_ORIGIN` | por ahora `http://localhost:5173`; se cambia en el paso 5 |
   | `CV_STORAGE_DIR` | `/tmp/techmatch-cvs` |
   | `JOB_SYNC_ENABLED` | `false` |
   | `LOG_LEVEL` | `info` |

5. En **Advanced**: **Health Check Path** `/api/health` y **Auto-Deploy** "After CI Checks Pass" (despliega `main` solo si pasa el CI de GitHub).
6. **Create Web Service**. El primer despliegue instala, compila el backend, aplica las migraciones y arranca. Verificar: `https://techmatch-api.onrender.com/api/health` responde `{"data":{"status":"ok"}}`.

### Paso 4 — Frontend en Cloudflare Pages

1. En <https://dash.cloudflare.com>: **Workers & Pages → Create → Pages → Connect to Git** (si el asistente ofrece Workers, buscar la opción de **Pages**). Elegir el repositorio `TechMatch`.
2. Completar:

   | Campo | Valor |
   | --- | --- |
   | Project name | `techmatch` (define la URL: `https://techmatch.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build -w frontend` |
   | Build output directory | `frontend/dist` |
   | Root directory | vacío (la raíz: ahí están `package.json` y `package-lock.json` de los workspaces) |

   Pages instala las dependencias solo (detecta `package-lock.json`) antes de compilar.

3. En **Environment variables** (Production):

   | Variable | Valor |
   | --- | --- |
   | `NODE_VERSION` | `24` |
   | `VITE_API_URL` | `https://techmatch-api.onrender.com` (sin `/` final) |

4. **Save and Deploy**. Al terminar, la app queda en `https://techmatch.pages.dev`.

`VITE_API_URL` se lee **al compilar**: si cambia la URL del backend, hay que volver a desplegar el frontend (**Deployments → Retry deployment**).

### Paso 5 — Autorizar el frontend en el backend

En Render → `techmatch-api` → **Environment**: cambiar `CORS_ORIGIN` a la URL de Pages, por ejemplo `https://techmatch.pages.dev`, y guardar (Render redespliega). Admite varios orígenes separados por coma, por ejemplo si después se agrega un dominio propio: `https://techmatch.pages.dev,https://www.mi-dominio.com`.

Las URL de vista previa de Pages (`https://<hash>.techmatch.pages.dev`) no están autorizadas, así que en ellas la app no puede llamar a la API. Para probar una rama, usar el entorno local.

### Paso 6 — Cargar las ofertas

En GitHub: **Actions → Sync jobs → Run workflow**. A partir de ahí se repite sola cada 12 horas.

### Paso 7 — Verificar

* `https://techmatch-api.onrender.com/api/health` responde `{"data":{"status":"ok"}}`.
* Abrir `https://techmatch.pages.dev`, subir un CV y recorrer: recomendaciones → detalle → adaptar CV → descargar PDF. Entrar directo a una ruta interna (por ejemplo, recargar la página de recomendaciones) también debe funcionar.
* Si el navegador muestra un error de CORS en la consola: revisar que `CORS_ORIGIN` sea exactamente la URL de Pages (con `https://` y sin `/` final).

## Día a día

* **Desplegar:** automático en los dos servicios con cada push a `main`. Render espera a que pase el CI; Cloudflare Pages compila el frontend en cada push (si el CI falla, el frontend igual se publica: conviene no mergear a `main` sin `npm run ci` en verde, como indica el flujo de trabajo).
* **Migraciones:** se aplican solas al arrancar el backend (son idempotentes).
* **Ver errores:** backend en Render → servicio → **Logs**; frontend en Cloudflare → proyecto → **Deployments**.
* **Forzar una sincronización:** Actions → Sync jobs → Run workflow.

## La sincronización de ofertas falla con HTTP 403

El workflow habla directo con la API de Get on Board y con Neon; no depende de Render. Si una ejecución termina con `getonboard refused access (HTTP 403)`, la fuente rechazó la conexión desde la máquina de GitHub (las IP de GitHub Actions son de centros de datos y a veces quedan bloqueadas). El proyecto **no reintenta ni evade** esos bloqueos. Una sincronización fallida no desactiva ofertas: el sitio sigue mostrando las de la última sincronización correcta. Si pasa siempre, consultar a Get on Board o correr la sincronización desde otra máquina (`npm run sync-jobs -w backend` con `DATABASE_URL` de Neon).

## Probar el modo producción en local

```bash
npm run build -w backend
NODE_ENV=production PORT=3400 CORS_ORIGIN=http://localhost:4173 JOB_SYNC_ENABLED=false \
DATABASE_URL=postgres://techmatch:techmatch@localhost:5434/techmatch \
sh -c 'node backend/dist/main/migrate.js && node backend/dist/main/server.js'

# en otra terminal: el frontend compilado apuntando a esa API
VITE_API_URL=http://localhost:3400 npm run build -w frontend
npx vite preview --config frontend/vite.config.ts frontend --port 4173
```

Abrir <http://localhost:4173>: es la misma combinación que Pages + Render.

El backend también puede servir el frontend compilado en el mismo origen (`FRONTEND_DIST_DIR=frontend/dist`, sin `VITE_API_URL`), para desplegar todo en un solo servicio si alguna vez conviene.

## Más adelante

* **Plan pago de Render** (sin dormir, más recursos): mismo servicio, cambiando el tipo de instancia.
* **Dominio propio:** en Pages, **Custom domains**; sumarlo a `CORS_ORIGIN`.
* **Backend en Cloudflare** con Workers + Containers (requiere el plan Workers Paid): el backend sin cambios dentro de un contenedor, con un `Dockerfile` y un Worker que rutee `/api/*`.
* **Almacenamiento de PDFs** (si se necesita conservarlos): implementar el puerto `FileStorage` sobre un servicio de objetos (por ejemplo, Cloudflare R2).

## Referencias

* [Cloudflare Pages: compilar un proyecto con Git](https://developers.cloudflare.com/pages/configuration/git-integration/)
* [Cloudflare Pages: SPA y páginas no encontradas](https://developers.cloudflare.com/pages/configuration/serving-pages/)
* [Cloudflare Pages: límites](https://developers.cloudflare.com/pages/platform/limits/)
* [Render: instancias gratuitas](https://render.com/docs/free)
* [Render: web services](https://render.com/docs/web-services)
* [Neon: precios y plan gratuito](https://neon.com/pricing)
* [Cloudflare Workers: precios y límites](https://developers.cloudflare.com/workers/platform/pricing/)
