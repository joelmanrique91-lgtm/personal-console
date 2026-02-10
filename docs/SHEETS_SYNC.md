# Sync con Google Sheets (modo workspace)

El backend usa Apps Script y sincroniza por `workspaceKey`.
No hay login de Google en frontend.

## Flujo

1. Abrir **Configuración > Sync**.
2. Revisar `WebApp URL` y `Workspace`.
3. Presionar **Guardar**.
4. Presionar **Sync now**.

## Compartir entre dispositivos (PC + celular)

Para ver las mismas tareas en varios dispositivos:

1. Usar exactamente el mismo `webAppUrl`.
2. Usar exactamente el mismo `workspaceKey`.
3. Hacer `Sync now` en ambos.

## Indicadores

- online/offline
- lastSyncAt
- serverTime
- ops pendientes
- último error

## Notas offline-first

- Las tareas y la cola de operaciones viven en IndexedDB (`localforage`).
- Si no hay internet, podés crear/editar tareas.
- Al volver online, la app intenta sync automático (si hay ops pendientes y settings completos).
