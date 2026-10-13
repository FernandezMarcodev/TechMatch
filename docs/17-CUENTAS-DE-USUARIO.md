# Cuentas de usuario

**Versión:** v2.1 (ver `14-PLAN-DE-DESARROLLO.md`, tickets 9 a 16).

## Objetivo

Permitir que una persona cree una cuenta con email y contraseña para, más adelante, guardar sus CVs, ver su historial y reabrir sus CVs adaptados.

**La cuenta es opcional, pero tiene privilegios.** Sin registrarse se puede subir un CV y ver las primeras recomendaciones.

## Privilegios de la cuenta

| Función | Sin cuenta | Con cuenta |
| --- | --- | --- |
| Subir un CV y ver su análisis | ✓ | ✓ |
| Recomendaciones | las primeras `ANONYMOUS_RECOMMENDATIONS_LIMIT` (3 por defecto) | todas |
| Adaptar el CV a una oferta (borrador, editor, recálculo y PDF) | — | ✓ |
| CVs guardados con historial (sin cuenta se borran a los 30 días) | — | ✓ |

* **Se aplican en la API**, no solo en la interfaz: ocultar un botón no alcanza, porque cualquiera puede llamar a la API directamente. Los endpoints de adaptación responden `401 UNAUTHENTICATED` sin sesión, y el de recomendaciones devuelve solo las primeras e informa cuántas quedan ocultas (`hiddenCount`).
* En la interfaz, lo exclusivo se muestra con un candado y un llamado a "Crear cuenta" o "Iniciar sesión", que vuelve a la misma página después de entrar.
* **Portada:** al entrar al sitio se ve la pantalla de inicio de sesión (con la propuesta de TechMatch y lo que suma la cuenta) y un enlace "Continuar sin cuenta" que lleva a la carga del CV (`/analizar`). Con la sesión iniciada, la portada lleva directo a `/analizar`.

## Etapas

Cada etapa es una rama y deja el sistema funcionando:

| Etapa | Rama | Resultado |
| --- | --- | --- |
| 1. Cuenta básica | `feat/auth-backend`, `feat/auth-frontend` | Registro, login, logout y "usuario actual". La cuenta queda activa al crearse. |
| 2. Email | `feat/email` | El sistema puede mandar mails (Mailpit en desarrollo, Brevo en producción). |
| 3. Verificación | `feat/verificar-email` | Al registrarse llega un link; **sin verificar el email no se puede iniciar sesión**. |
| 4. Recuperación | `feat/recuperar-contrasena` | "Olvidé mi contraseña" con un link por email. |

## Reglas

### Datos de la cuenta

* Se guarda solo lo necesario: email, hash de la contraseña, fecha de verificación del email y fechas de alta y modificación. No se pide nombre ni otros datos.
* El email se normaliza (sin espacios y en minúsculas) y es único.
* Contraseña: entre 8 y 128 caracteres. No se imponen reglas de composición (mayúsculas, símbolos): la longitud es lo que más aporta, como recomienda NIST SP 800-63B.

### Contraseñas

* Se guardan con **`scrypt`**, la función de derivación de claves que trae Node (`node:crypto`), con un salt aleatorio por usuario. Es un algoritmo pensado para contraseñas (lento y costoso en memoria a propósito), recomendado por OWASP, y no agrega dependencias.
* Formato guardado: `scrypt$<salt>$<hash>` (base64). Así se puede cambiar el algoritmo en el futuro sabiendo con cuál se generó cada hash.
* La comparación usa `timingSafeEqual`, para no revelar información por el tiempo de respuesta.
* La contraseña nunca se loguea ni se devuelve.

### Sesiones

* Al iniciar sesión, la API genera un **token aleatorio** (32 bytes de `crypto.randomBytes`) y lo devuelve una sola vez.
* La base guarda solo el **hash SHA-256 del token**, con su usuario y su vencimiento (`SESSION_TTL_DAYS`, 30 días por defecto). Si alguien leyera la base, no podría usar los tokens.
* El frontend guarda el token en `localStorage` y lo manda en cada pedido: `Authorization: Bearer <token>`.
* Logout borra la sesión de la base: el token deja de servir al instante.
* Una sesión vencida o inexistente responde `401 UNAUTHENTICATED`.

**Por qué no una cookie:** el frontend (`pages.dev`) y la API (`onrender.com`) están en dominios distintos, así que una cookie de la API sería "de terceros" para el navegador, y Safari (todos los iPhone) las bloquea por defecto. Las alternativas eran un proxy en Cloudflare (otra pieza de infraestructura) o comprar un dominio propio. Se eligió el token en el encabezado por simple y porque funciona en todos los navegadores.

**Riesgo asumido:** un script inyectado en la página (XSS) podría leer el token de `localStorage`. Se mitiga porque React escapa todo el contenido que muestra, no se usa `dangerouslySetInnerHTML` con datos externos y no se cargan scripts de terceros. Con un dominio propio, se pasaría a una cookie `httpOnly`. A cambio, al no usar cookies no hay riesgo de CSRF.

### Límite de intentos

* Registro, login, reenvío de verificación y recuperación de contraseña usan el mismo limitador por IP que la carga de CVs (`AUTH_LIMIT_MAX` pedidos cada `AUTH_LIMIT_WINDOW_MINUTES`, por defecto 10 cada 15 minutos). Frena los intentos de adivinar contraseñas y el envío masivo de mails.

### Mensajes que no revelan cuentas

* Login con email inexistente o contraseña incorrecta: el mismo error, `INVALID_CREDENTIALS` ("Email o contraseña incorrectos.").
* Recuperación de contraseña y reenvío de verificación: siempre la misma respuesta, exista o no la cuenta.
* Registro con un email ya registrado: responde `EMAIL_ALREADY_REGISTERED`. Esto sí revela que el email tiene cuenta, como hace la mayoría de los sitios, porque la alternativa (responder siempre igual y avisar por mail) complica el registro. El límite de intentos impide recorrer emails en masa.

### Tokens por email (etapas 3 y 4)

* Verificación de email y recuperación de contraseña usan el mismo mecanismo: un token aleatorio que viaja en un link al frontend, del que la base guarda solo el hash, con un propósito (`VERIFY_EMAIL` o `RESET_PASSWORD`), un vencimiento y una marca de uso.
* Vencimientos: verificación 24 horas (`EMAIL_VERIFICATION_TTL_HOURS`), recuperación 30 minutos (`PASSWORD_RESET_TTL_MINUTES`).
* **Un solo uso:** al usarse queda marcado y no sirve de nuevo. Pedir un token nuevo invalida los anteriores del mismo propósito.
* Cambiar la contraseña por recuperación cierra todas las sesiones abiertas del usuario.
* Abrir el link de recuperación demuestra que el email es de la persona, así que además marca el email como verificado (una cuenta sin verificar no queda bloqueada si nunca recibió el primer email).
* Pedir la recuperación responde `202` siempre: también cuando el email no existe o cuando falla el envío (queda en el log como `Password reset email failed`), para no revelar qué emails tienen cuenta.
* Un link de verificación no sirve para recuperar la contraseña ni al revés: cada token tiene su propósito.
* El link apunta al frontend (`FRONTEND_URL`; si no está definida, el primer origen de `CORS_ORIGIN`, que en el despliegue habitual es la URL de Cloudflare Pages), que llama a la API con el token.
* Si el email de verificación no se puede mandar al registrarse, la cuenta igual se crea (el error queda en el log) y la persona puede pedir el reenvío desde "Revisá tu email" o al intentar iniciar sesión.
* `EMAIL_NOT_VERIFIED` se responde solo con la contraseña correcta: con una incorrecta, el error es el genérico, así que no revela el estado de la cuenta.
* Las cuentas creadas antes de la etapa 3 quedan sin verificar; al intentar entrar, el login ofrece reenviar el link.

### Email

* Puerto `EmailSender` con tres implementaciones, elegidas por `EMAIL_PROVIDER`:
  * `smtp` (`SmtpEmailSender`): Nodemailer contra **Mailpit** (contenedor en `docker-compose`, lo levanta `npm run db:up`; los mails se ven en `http://localhost:8025` y nunca salen a internet). Para desarrollo y e2e.
  * `brevo` (`BrevoEmailSender`): la **API HTTP de Brevo** (plan gratuito, 300 mails por día) con un `fetch`. Para producción, porque Render free bloquea los puertos SMTP desde septiembre de 2025.
  * `MemoryEmailSender`: guarda los mails en memoria. Para los tests.
* Están en `backend/src/infrastructure/email/`; `createEmailSender` elige según la configuración.
* `npm run send-test-email -w backend -- <email>` manda un mail de prueba con el proveedor configurado, para comprobar la configuración.
* Remitente: `EMAIL_FROM` (dirección) y `EMAIL_FROM_NAME` (nombre visible). Sin dominio propio, es un email personal verificado como remitente en Brevo; algunos mails pueden llegar a spam, lo que se acepta para este proyecto.
* Los mails son en español y en texto simple con el link; nunca incluyen la contraseña.

### Datos personales

* Borrar la cuenta (ticket `feat/mis-cvs`) borra el usuario, sus sesiones, sus tokens y sus CVs.
* La limpieza automática de CVs (`npm run purge-cvs`) sigue aplicando a los CVs anónimos. Los de un usuario se conservan hasta que los borre él o borre la cuenta.

## Modelo de datos

```text
users
  id UUID PK
  email VARCHAR(254) UNIQUE NOT NULL     -- normalizado
  password_hash TEXT NOT NULL            -- scrypt$salt$hash
  email_verified_at TIMESTAMPTZ NULL     -- etapa 3
  created_at, updated_at

sessions
  id UUID PK
  user_id UUID FK → users ON DELETE CASCADE
  token_hash CHAR(64) UNIQUE NOT NULL    -- SHA-256 en hex
  expires_at TIMESTAMPTZ NOT NULL
  created_at

email_tokens                             -- etapas 3 y 4
  id UUID PK
  user_id UUID FK → users ON DELETE CASCADE
  purpose VARCHAR(20) CHECK IN ('VERIFY_EMAIL', 'RESET_PASSWORD')
  token_hash CHAR(64) UNIQUE NOT NULL
  expires_at TIMESTAMPTZ NOT NULL
  used_at TIMESTAMPTZ NULL
  created_at
```

## API

Todas bajo `/api/auth`, con las convenciones de `04-API-CONTRACTS.md`. Los endpoints que requieren sesión llevan `Authorization: Bearer <token>`.

| Método y ruta | Etapa | Request | Respuesta |
| --- | --- | --- | --- |
| `POST /api/auth/register` | 1 | `{ email, password }` | `201 { data: { user } }` |
| `POST /api/auth/login` | 1 | `{ email, password }` | `200 { data: { token, expiresAt, user } }` |
| `POST /api/auth/logout` | 1 | sesión | `204` |
| `GET /api/auth/me` | 1 | sesión | `200 { data: { user } }` |
| `POST /api/auth/verify-email` | 3 | `{ token }` | `200 { data: { user } }` |
| `POST /api/auth/verify-email/resend` | 3 | `{ email }` | `202`, siempre |
| `POST /api/auth/password-reset` | 4 | `{ email }` | `202`, siempre |
| `POST /api/auth/password-reset/confirm` | 4 | `{ token, password }` | `204` |

`user` se expone como `{ id, email, emailVerified, createdAt }`; nunca el hash ni las sesiones.

En la etapa 3, `register` deja de considerar la cuenta lista: manda el email de verificación, y `login` responde `EMAIL_NOT_VERIFIED` mientras no se verifique.

### Errores nuevos

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | email con formato inválido o contraseña fuera de largo (`details.issues`) |
| `EMAIL_ALREADY_REGISTERED` | 409 | registro con un email que ya tiene cuenta |
| `INVALID_CREDENTIALS` | 401 | email o contraseña incorrectos |
| `UNAUTHENTICATED` | 401 | falta el token, o la sesión venció o no existe |
| `EMAIL_NOT_VERIFIED` | 403 | login de una cuenta sin verificar (etapa 3) |
| `INVALID_TOKEN` | 400 | token de verificación o recuperación inválido, vencido o ya usado (etapas 3 y 4) |
| `RATE_LIMITED` | 429 | demasiados intentos desde la misma IP |

## Frontend

* Páginas: **Crear cuenta** (`/crear-cuenta`), **Iniciar sesión** (`/ingresar`) y **Mi cuenta** (`/cuenta`, con el email, la fecha de alta y "Cerrar sesión"); en la etapa 3, **Verificar email** (`/verificar-email?token=…`); en la etapa 4, **Olvidé mi contraseña** y **Nueva contraseña** (`/restablecer?token=…`).
* Desde la etapa 3, crear la cuenta muestra "Revisá tu email" (con "Reenviar email de verificación") y no inicia sesión. Si alguien sin verificar intenta entrar, el error ofrece el mismo botón de reenvío. `/verificar-email` llama una sola vez a la API (el link sirve una vez) y, si sale bien, invita a iniciar sesión.
* Recuperación: "¿Olvidaste tu contraseña?" en el login lleva a `/olvide-contrasena` (pide el email y responde siempre "Si existe una cuenta…"). El link abre `/restablecer`, que pide la nueva contraseña dos veces; al guardarla se cierra también la sesión del navegador y se invita a iniciar sesión. Si el link venció, ofrece pedir uno nuevo.
* En la barra superior: "Iniciar sesión" para visitantes; el email (enlace a "Mi cuenta") para usuarios logueados. En el celular se muestra solo el ícono.
* `AuthProvider` (contexto de React) guarda el usuario actual; al abrir la app, si hay token, se llama a `/api/auth/me` (si responde 401, se borra el token). El token vive en `localStorage` (`techmatch.session`); si el navegador no permite guardarlo, dura hasta cerrar la pestaña.
* `RequireAuth` protege las páginas que requieren cuenta: redirige a "Iniciar sesión" y vuelve a la página pedida después de entrar.
* Subir un CV, ver recomendaciones y adaptar un CV siguen funcionando sin cuenta.

## Configuración nueva

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `SESSION_TTL_DAYS` | `30` | Duración de una sesión |
| `AUTH_LIMIT_MAX` / `AUTH_LIMIT_WINDOW_MINUTES` | `10` / `15` | Límite de intentos por IP |
| `EMAIL_PROVIDER` | `smtp` | `smtp` (Mailpit) o `brevo` |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | Mailpit |
| `BREVO_API_URL` | `https://api.brevo.com/v3` | API de Brevo |
| `BREVO_API_KEY` | — | Obligatoria con `brevo` |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | `no-reply@techmatch.local` / `TechMatch` | Remitente |
| `FRONTEND_URL` | primer origen de `CORS_ORIGIN` | Base de los links de los mails |
| `EMAIL_VERIFICATION_TTL_HOURS` | `24` | Vencimiento del link de verificación |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Vencimiento del link de recuperación |

## Producción

Los pasos para configurar Brevo están en `16-DESPLIEGUE.md` (§ Emails con Brevo). Tienen que estar hechos **antes** de desplegar la etapa 3: desde ahí, la API necesita mandar mails para que alguien pueda crear una cuenta.

## Criterios de aceptación

* Se puede crear una cuenta, iniciar sesión, ver el usuario actual y cerrar sesión; después de cerrar sesión, el token anterior responde 401.
* La base no contiene contraseñas ni tokens en texto plano.
* Un email mal escrito o una contraseña de menos de 8 caracteres se rechazan con un mensaje claro.
* Login con una contraseña incorrecta y con un email inexistente devuelven el mismo error.
* Pasado el límite de intentos, la API responde 429.
* (Etapa 3) Sin verificar el email no se puede iniciar sesión; el link de verificación funciona una sola vez y vence a las 24 horas.
* (Etapa 4) El link de recuperación funciona una sola vez, vence a los 30 minutos y, al usarse, cierra las sesiones abiertas.
* El flujo anónimo sigue funcionando sin cuenta.
