# Personal Console

Web app offline-first para Inbox/Hoy/Semana/Algún día con Focus y Review diarios.

## Requisitos

- Node.js 18+
- npm
- (Opcional) `cloudflared` para túnel rápido
  - Windows: `winget install Cloudflare.cloudflared`

## Ejecutar local

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

La app corre en `http://localhost:5173`.

## Ejecutar túnel

```bash
cloudflared tunnel --url http://localhost:5173
```

Abrí la URL pública `https://*.trycloudflare.com` en tu celular.

## Funcionalidad

- **Inbox** con captura rápida y atajos: `@contexto`, `#tag`, `!alta/!media/!baja`, `~10m`.
- **Board** con drag & drop, filtros por stream/prioridad y warning en “Hoy” si hay más de 5 tareas.
- **Focus** con timer simple, registro de sesiones y bloqueo con nota obligatoria.
- **Review** con métricas diarias y acciones rápidas.
- **Command palette** (Ctrl+K) con búsqueda instantánea y acciones rápidas.
- **Export/Import** de JSON con merge por `id`.
- Persistencia offline con IndexedDB (localforage).

## Sync con Google Sheets (sin login)

- El sync usa únicamente `WebApp URL` y `Workspace`.
- Para compartir datos entre PC y celular, ambos deben usar exactamente el mismo `webAppUrl` y `workspaceKey`.
- La app viene preconfigurada con:
  - `webAppUrl`: `https://script.google.com/macros/s/AKfycbxsXswsRCkAj5OePyGEVoNT5Q5N34SKmJcAEj3EpqNWryVUfS1gcPDnU7Fp42b0dickQw/exec`
  - `workspaceKey`: `joel-main`

Ver guía: `docs/SHEETS_SYNC.md`.
