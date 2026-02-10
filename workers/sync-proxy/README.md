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
APPS_SCRIPT_EXEC = "https://script.google.com/macros/s/AKfycbx05PRTxlEHqcofb14LnhqTDJR9JsD498nFDwJ4a3aMXBvYMjXsnWkdUa2tL7dgQq5mHg/exec"
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

- En Settings → Sync, usar por default la URL absoluta del Worker: `https://personal-console-sync-proxy.joel-personal-console.workers.dev/api`.
- `/api` relativo solo si ese origen realmente enruta `/api` hacia este Worker.
