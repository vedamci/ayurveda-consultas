# Despliegue — Ayurveda Consultas (VEDAMCI)

Esta app es un servidor **Express** que sirve la **API** y, en producción, también el
**frontend React** ya compilado. Por eso se despliega como **un solo servicio** en Render.
No hace falta Vercel para que funcione (ver la nota al final si lo quieres igual).

---

## 1. Requisitos previos

- El repo ya está en GitHub: `vedamci/ayurveda-consultas`.
- Tener a mano los valores que hoy están en tu `.env` local (Notion, DeepSeek, Google).
  Estos **no** están en el repo (por seguridad) y se cargan en el panel de Render.

---

## 2. Crear el servicio en Render

1. Entra a https://dashboard.render.com → **New** → **Blueprint**.
2. Conecta tu cuenta de GitHub y elige el repo `ayurveda-consultas`.
3. Render leerá `render.yaml` automáticamente y propondrá el servicio `ayurveda-consultas`.
4. Te pedirá completar las variables marcadas como secretas (ver sección 3).
5. Pulsa **Apply / Deploy**.

> Plan: el `render.yaml` usa `starter` ($7/mes) porque incluye **disco persistente**
> (necesario para que fotos/PDFs/planes guardados en archivos no se borren al redeploy).
> Si quieres probar gratis primero, cambia `plan: starter` por `plan: free` y borra el
> bloque `disk:`. Notion seguirá funcionando; solo los archivos locales serían temporales.

---

## 3. Variables de entorno (en el panel de Render)

Copia los valores desde tu `.env` local:

| Variable | Qué es | Ejemplo / valor |
|---|---|---|
| `NOTION_API_KEY` | Token privado de la integración de Notion (solo servidor) | `ntn_...` |
| `NOTION_DATABASE_ID` | ID de la base de datos de pacientes | `83edcbb7-9ce1-4251-95fe-1cf01820210a` |
| `DEEPSEEK_API_KEY` | Clave de DeepSeek (IA) | `sk-...` |
| `DEEPSEEK_MODEL` | Modelo | `deepseek-v4-flash` |
| `DEEPSEEK_BASE_URL` | URL base | `https://api.deepseek.com` |
| `GOOGLE_CLIENT_ID` | OAuth de Google Calendar | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth de Google Calendar | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Callback en el dominio nuevo | `https://TU-APP.onrender.com/api/calendar/auth/callback` |
| `GOOGLE_REFRESH_TOKEN` | Token de refresco (si ya lo tienes) | `1//...` |
| `GOOGLE_CALENDAR_ID` | Calendario a usar | `primary` |

Ya definidas en `render.yaml` (no las toques): `NODE_ENV=production`, `HOST=0.0.0.0`,
`DATA_DIR=/var/data`.

---

## 4. Verificar que Notion funciona (en vivo)

Tras el deploy, abre en el navegador:

```
https://TU-APP.onrender.com/api/health
```

Respuesta esperada:

```json
{
  "server": "ok",
  "notionConfigured": true,
  "notionAuth": true,
  "notionDatabase": true
}
```

- `notionAuth: true` → el token es válido.
- `notionDatabase: true` → la integración tiene acceso a la base de datos.

Si `notionDatabase` es `false`: en Notion, abre la base de datos → menú **···** →
**Connections / Conexiones** → añade tu integración. Es el fallo más común.

Render también usa este `/api/health` como health check del servicio.

---

## 5. Calendario de Google (importante)

El calendario funciona con OAuth. Al cambiar de dominio hay que registrar la nueva URL:

1. https://console.cloud.google.com → **APIs & Services** → **Credentials**.
2. Abre tu **OAuth 2.0 Client ID**.
3. En **Authorized redirect URIs** añade:
   `https://TU-APP.onrender.com/api/calendar/auth/callback`
4. Guarda. Pon esa misma URL en la variable `GOOGLE_REDIRECT_URI` de Render.
5. En la app, vuelve a conectar el calendario para generar el `GOOGLE_REFRESH_TOKEN`
   con el dominio nuevo.

---

## 6. (Opcional) Frontend en Vercel

No es necesario, pero si quieres servir la web desde el CDN de Vercel y dejar Render solo
para la API: despliega el repo en Vercel (build `npm run build`, output `dist`) y añade un
`vercel.json` con un rewrite que reenvíe `/api/(.*)` a `https://TU-APP.onrender.com/api/$1`.
Avísame y lo configuro.

---

## 7. Despliegue automático desde GitHub a cPanel

El servidor expone `POST /api/deploy/github` para recibir únicamente eventos firmados
por GitHub. El receptor valida la firma HMAC-SHA256, el repositorio y la rama `main` antes
de ejecutar `git pull --ff-only origin main`. Si cambió `package-lock.json` o falta
Puppeteer, también ejecuta `npm install --omit=dev` antes de reiniciar Passenger. Esto es
necesario para que la exportación PDF disponga de Chromium en cPanel.

1. Genera un secreto aleatorio largo y guárdalo como `GITHUB_WEBHOOK_SECRET` en el `.env`
   privado del servidor.
2. Configura `GITHUB_REPOSITORY=vedamci/ayurveda-consultas`.
3. En GitHub → **Settings → Webhooks → Add webhook** usa:
   - Payload URL: `https://consultas.vedamci.com.mx/api/deploy/github`
   - Content type: `application/json`
   - Secret: exactamente el mismo valor del servidor
   - Events: solo **push events**
4. Conserva cPanel en la rama `main` y verifica que el último delivery responda `200`.

El secreto nunca debe incluirse en Git ni compartirse en registros o capturas.

---

## Notas de arquitectura

- **Datos clínicos principales** → viven en **Notion** (no dependen del disco de Render).
- **Archivos locales** (fotos de lengua, PDFs, planes, notas, pulsos) → carpeta `DATA_DIR`
  (`/var/data` en el disco persistente de Render). En plan `free` sin disco, son temporales.
- Migrar estos archivos a almacenamiento de objetos (S3/Cloudflare R2) sería el siguiente
  paso para escalar sin depender de disco; no es necesario para empezar.
