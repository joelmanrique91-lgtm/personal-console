# Backend (Apps Script + Google Sheets)

El backend actual sincroniza por `workspaceKey` y no requiere login de Google en frontend.

- Spreadsheet creado/asegurado: `Personal Console DB`
- Hojas: `Tasks`, `Ops`, `TaskEvents`, `FocusSessions`
- Idempotencia: `(workspaceKey, opId)` en hoja `Ops`
- Resolución de conflictos: LWW por `updatedAt`, desempate por `revision`, empate total => conflicto (si hay `clientId`) o server wins.
