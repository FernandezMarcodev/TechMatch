# Despliegue en Cloudflare

**Estado:** guía de despliegue propuesta. Los archivos de configuración de esta guía (`Dockerfile`, Worker y `wrangler.jsonc`) todavía no están en el repositorio; se agregan en una rama propia cuando se decida desplegar. Los productos de Cloudflare cambian seguido: antes de ejecutar, verificar cada paso con la documentación oficial enlazada al final.

## Resumen

TechMatch es un frontend estático (React) más un backend Node.js/Express con PostgreSQL. Para desplegarlo en Cloudflare **sin reescribir el backend** se usa:

| Pieza | Dónde corre | Producto de Cloudflare |
| --- | --- | --- |
| Frontend (`frontend/dist`) | Archivos estáticos servidos por un Worker | Workers (Static Assets) |
| Backend (Express, igual que hoy) | Contenedor Docker | Containers |
| Ruteo `/api/*` → backend | El mismo Worker | Workers + Durable Objects |
| PostgreSQL | Proveedor externo (por ejemplo Neon o Supabase) | — |
| Sincronización de ofertas cada 12 h | GitHub Actions programado (o Cron Trigger) | — |

```text
Navegador
   │  https://techmatch.<cuenta>.workers.dev
   ▼
Worker "techmatch"
   ├── /api/*  ──► Container "Backend" (Express, puerto 8080) ──► PostgreSQL externo
   └── resto  ──► archivos estáticos del frontend (SPA)
```

Frontend y API quedan en el **mismo dominio**: el frontend sigue llamando a `/api` como en desarrollo, sin cambios de código ni CORS.

## Por qué así

* **Containers** ejecuta la imagen Docker del backend tal cual: Express, `pg`, `unpdf` y el procesamiento asíncrono funcionan sin adaptarlos al runtime de Workers.
* **PostgreSQL externo:** Cloudflare no ofrece PostgreSQL administrado. El esquema y las migraciones actuales se mantienen.
* **Una sola instancia del backend** (`max_instances: 1`): el procesamiento de CVs corre en memoria y la recuperación al iniciar supone una única instancia (ver `13-DECISIONES-TECNICAS.md`). Escalar a varias requiere una cola persistente.

## Requisitos

* Cuenta de Cloudflare con **plan Workers Paid** (Containers no está disponible en el plan gratuito).
* Docker Desktop corriendo en la máquina que despliega (Wrangler construye y sube la imagen).
* Node.js 22.12+ y Wrangler 4+ (`npx wrangler --version`).
* Una base PostgreSQL accesible desde internet con TLS (por ejemplo, un proyecto de Neon o Supabase).

## Limitaciones a tener en cuenta

| Tema | Comportamiento | Impacto en TechMatch |
| --- | --- | --- |
| Disco del contenedor | **Efímero**: se pierde al reiniciar o dormir | Los PDF subidos se borran. No afecta el uso: el texto y el perfil quedan en la base, y el PDF no se vuelve a leer. Para conservarlos, implementar `FileStorage` sobre R2. |
| Inactividad | El contenedor **duerme** tras `sleepAfter` sin requests | El primer request después de dormir tarda más (arranque en frío). El scheduler interno no corre mientras duerme: por eso la sincronización se programa afuera. |
| Arquitectura | La imagen debe ser `linux/amd64` | Usar una imagen base oficial de Node. |
| Primer despliegue | Puede tardar unos minutos en aceptar requests | Esperar antes de probar. |

## Archivos a agregar al repositorio

### 1. `Dockerfile` (raíz del repo)

```dockerfile
# Build: dependencias del monorepo y compilación del backend.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend backend
RUN npm run build -w backend

# Runtime: solo lo necesario para ejecutar el backend.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 CV_STORAGE_DIR=/tmp/cvs
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend
COPY --from=build /app/backend/dist backend/dist
COPY backend/migrations backend/migrations
EXPOSE 8080
CMD ["node", "backend/dist/main/server.js"]
```

### 2. Worker: `deploy/cloudflare/src/index.ts`

```ts
import { Container } from '@cloudflare/containers';

interface Env {
  BACKEND: DurableObjectNamespace<Backend>;
  ASSETS: Fetcher;
  DATABASE_URL: string; // secret
}

/** The Express backend, unchanged, running in a container. */
export class Backend extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '30m';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL,
      LOG_LEVEL: 'info',
      JOB_SYNC_ENABLED: 'false', // the sync runs on a schedule outside the container
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      // A single named instance: processing is in-memory (see docs/13).
      return env.BACKEND.getByName('api').fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
```

### 3. Configuración: `deploy/cloudflare/wrangler.jsonc`

```jsonc
{
  "name": "techmatch",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "../../frontend/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"],
  },
  "containers": [{ "class_name": "Backend", "image": "../../Dockerfile", "max_instances": 1 }],
  "durable_objects": { "bindings": [{ "name": "BACKEND", "class_name": "Backend" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Backend"] }],
}
```

`deploy/cloudflare/package.json` con `wrangler` y `@cloudflare/containers` como dependencias.

## Pasos

### 1. Crear la base de datos

Crear un proyecto PostgreSQL en el proveedor elegido y copiar la cadena de conexión con TLS:

```text
postgres://usuario:contraseña@host/techmatch?sslmode=require
```

### 2. Crear las tablas y cargar ofertas

Desde la máquina local, contra la base de producción:

```bash
DATABASE_URL="postgres://…?sslmode=require" npm run migrate -w backend
DATABASE_URL="postgres://…?sslmode=require" npm run sync-jobs -w backend
```

### 3. Configurar el secreto

```bash
cd deploy/cloudflare
npm install
npx wrangler login
npx wrangler secret put DATABASE_URL
```

### 4. Compilar el frontend y desplegar

```bash
npm run build -w frontend          # desde la raíz: genera frontend/dist
cd deploy/cloudflare
npx wrangler deploy                # construye la imagen, la sube y publica el Worker
```

### 5. Verificar

```bash
curl https://techmatch.<tu-subdominio>.workers.dev/api/health
# {"data":{"status":"ok"}}
```

Después, abrir la URL en el navegador y recorrer el flujo: subir CV → recomendaciones → detalle → adaptar CV.

### 6. Sincronización de ofertas cada 12 horas

El contenedor duerme cuando no hay uso, así que el scheduler interno no sirve. La opción más simple, sin cambios de código, es un workflow programado de GitHub Actions que corre la sincronización contra la base de producción (`.github/workflows/sync-jobs.yml`):

```yaml
name: Sync jobs
on:
  schedule:
    - cron: '0 */12 * * *'
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run sync-jobs -w backend
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

El secreto `PRODUCTION_DATABASE_URL` se carga en GitHub: Settings → Secrets and variables → Actions.

Alternativa más integrada: un **Cron Trigger** del Worker que llame a un endpoint interno del backend protegido con un token. Requiere agregar ese endpoint.

### 7. Despliegues siguientes

Repetir el paso 4. Si un cambio incluye migraciones, correr antes el paso 2 (`migrate`).

Para automatizarlo, un job de GitHub Actions en cada push a `main` (después del CI) puede ejecutar `npm run build -w frontend` y `wrangler deploy` con un API token de Cloudflare guardado como secreto.

## Proyectos existentes en Cloudflare

Hoy hay dos proyectos de **Workers Builds** (`techmatch` y `techmatchs`) conectados al repositorio que fallan en cada push, porque intentan construir el repositorio como un Worker sin esta configuración. Antes de desplegar con esta guía, eliminarlos o desconectarlos de GitHub, y publicar con `wrangler deploy` (o reconfigurar uno de ellos para que use `deploy/cloudflare` como directorio raíz).

## Alternativa sin Containers

Si no se quiere el plan pago: el frontend en Cloudflare (Workers Static Assets o Pages) y el backend en un servicio que ejecute contenedores Docker (por ejemplo Render, Railway o Fly.io) con el mismo `Dockerfile`. En ese caso el frontend necesita conocer la URL de la API (proxy en el Worker o variable de entorno de build) y el backend debe permitir ese origen en `CORS_ORIGIN`.

## Referencias

* [Cloudflare Containers: primeros pasos](https://developers.cloudflare.com/containers/get-started)
* [Containers: configuración de Wrangler](https://developers.cloudflare.com/containers/wrangler-configuration/)
* [Containers: documentación completa (disco efímero, variables de entorno, límites)](https://developers.cloudflare.com/containers/llms-full.txt)
* [Neon con Cloudflare Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/)
* [Neon: guía de Cloudflare Hyperdrive](https://neon.com/docs/guides/cloudflare-hyperdrive)
