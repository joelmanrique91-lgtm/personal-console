# Sync con Google Sheets (modo workspace)

El backend usa Apps Script y sincroniza por `workspaceKey` vía Worker.
No hay login de Google en frontend.

## Flujo estable (recomendado)

1. Abrir **Configuración > Sync**.
2. Usar `WebApp URL` absoluto del Worker:
   `https://personal-console-sync-proxy.joel-personal-console.workers.dev/api`
3. Usar `Workspace`: `joel-main`.
4. Presionar **Probar conexión** (`GET <base>/meta`).
5. Presionar **Sync now** (`POST <base>/sync`).

## Compartir entre dispositivos (PC + celular)

Para ver las mismas tareas en varios dispositivos:

1. Usar exactamente el mismo `webAppUrl` (Worker absoluto).
2. Usar exactamente el mismo `workspaceKey`.
3. Hacer `Sync now` en ambos.

## Indicadores

- online/offline
- lastSyncAt
- serverTime
- ops pendientes
- último error
- `lastRequestUrl`, `lastResponseStatus`, `lastResponseBodyPreview`

## Notas offline-first

- Las tareas y la cola de operaciones viven en IndexedDB (`localforage`).
- Si no hay internet, podés crear/editar tareas.
- Al volver online, la app intenta sync automático (si hay ops pendientes y settings completos).
