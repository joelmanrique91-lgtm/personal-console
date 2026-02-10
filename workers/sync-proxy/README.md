# Sync Proxy Worker (Cloudflare)

Proxy same-origin para evitar `SYNC_NETWORK_ERROR: Failed to fetch` al sincronizar desde browser hacia Apps Script.

## 1) Requisitos

- Node.js 18+
- Cuenta de Cloudflare
- `wrangler` instalado

## 2) Deploy (copy/paste)

```bash
cd workers/sync-proxy
npm i -g wrangler
wrangler login
wrangler deploy
```

El archivo `wrangler.toml` ya incluye:

```toml
[vars]
APPS_SCRIPT_EXEC = "https://script.google.com/macros/s/AKfycbxsXswsRCkAj5OePyGEVoNT5Q5N34SKmJcAEj3EpqNWryVUfS1gcPDnU7Fp42b0dickQw/exec"
```

Si querés sobrescribir la variable en Cloudflare:

```bash
wrangler secret put APPS_SCRIPT_EXEC
```

## 3) Endpoints

- `GET /api/meta`
- `GET /api/diag`
- `POST /api/sync`
- `OPTIONS` preflight soportado con CORS

## 4) Pruebas rápidas

```bash
curl -i https://<tu-worker-domain>/api/meta
```

```bash
curl -i -X POST "https://<tu-worker-domain>/api/sync" \
  -H "Content-Type: application/x-www-form-urlencoded;charset=UTF-8" \
  --data-urlencode 'payload={"workspaceKey":"joel-main","clientId":"diag","ops":[]}'
```

## 5) Configuración frontend

- En Settings → Sync, usar `webAppUrl` = `/api` (same-origin) o `https://<tu-worker-domain>/api`.
- No usar URL directa de Google Apps Script en browser.
