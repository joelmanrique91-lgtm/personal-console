# Sync Proxy (Cloudflare Worker)

Este proxy elimina el `SYNC_NETWORK_ERROR: Failed to fetch` en browser al evitar llamadas directas a Google Apps Script desde cliente.

## 1) Deploy del Worker

```bash
cd workers/sync-proxy
npm i -g wrangler
wrangler login
wrangler deploy
```

## 2) Variable APPS_SCRIPT_EXEC

En `workers/sync-proxy/wrangler.toml`:

```toml
[vars]
APPS_SCRIPT_EXEC = "https://script.google.com/macros/s/AKfycbxsXswsRCkAj5OePyGEVoNT5Q5N34SKmJcAEj3EpqNWryVUfS1gcPDnU7Fp42b0dickQw/exec"
```

Si necesitás setearla en Cloudflare:

```bash
wrangler secret put APPS_SCRIPT_EXEC
```

## 3) Endpoints del proxy

- `GET /api/meta` → forward a `.../exec?route=meta`
- `POST /api/sync` → forward a `.../exec?route=sync`
- `OPTIONS` → 204 con headers CORS

## 4) Pruebas

```bash
curl -i https://<tu-worker-domain>/api/meta
```

```bash
curl -i -X POST "https://<tu-worker-domain>/api/sync" \
  -H "Content-Type: application/x-www-form-urlencoded;charset=UTF-8" \
  --data-urlencode 'payload={"workspaceKey":"joel-main","clientId":"diag","ops":[]}'
```

## 5) Configuración de la app

- En Settings → Sync, usar:
  - `webAppUrl: /api` (same-origin recomendado), o
  - `https://<tu-worker-domain>/api`
- Si el usuario pega una URL de Google (`script.google.com` / `googleusercontent.com`), la app la migra automáticamente a `/api`.
