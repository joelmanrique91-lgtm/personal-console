# Sync Proxy (Cloudflare Worker)

Ruta estable de sync: **Frontend → Worker (URL absoluta) → Apps Script `/exec`**.

## 1) Deploy del Worker

```bash
cd workers/sync-proxy
npm i -g wrangler
wrangler login
wrangler deploy
```

## 2) Variable `APPS_SCRIPT_EXEC`

En `workers/sync-proxy/wrangler.toml`:

```toml
[vars]
APPS_SCRIPT_EXEC = "https://script.google.com/macros/s/AKfycbx05PRTxlEHqcofb14LnhqTDJR9JsD498nFDwJ4a3aMXBvYMjXsnWkdUa2tL7dgQq5mHg/exec"
```

## 3) Endpoints del proxy

- `GET /api/meta` → forward a `.../exec?route=meta`
- `GET /api/diag` → forward a `.../exec?route=diag`
- `POST /api/sync` → forward a `.../exec?route=sync`
- `OPTIONS` → `204` con headers CORS

## 4) Happy path único del Frontend

En **Settings → Sync**, usar siempre por defecto:

- `WebApp URL`:
  `https://personal-console-sync-proxy.joel-personal-console.workers.dev/api`
- `Workspace`:
  `joel-main`

> `/api` relativo solo sirve si el mismo origen de la web app enruta `/api` al Worker.
> No es el default recomendado.

## 5) Smoke test automático

Ejecutar:

```bash
./scripts/sync-smoke.sh
```

Valida:
1. `GET <worker>/meta` → `ok:true`
2. `POST <worker>/sync` → `ok:true`
3. `GET <apps-script-exec>?route=meta` → `ok:true`
