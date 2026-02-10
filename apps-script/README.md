# Apps Script backend (Personal Console)

## Deploy
1. Abrí Apps Script en tu cuenta Google.
2. Pegá `apps-script/Code.gs` y guardá.
3. Deploy > New deployment > Web app.
4. Execute as: Me.
5. Who has access: Anyone with the link.
6. Copiá la URL `/exec`.

## Hojas creadas automáticamente
- Users: `userId | email | createdAt | lastSeenAt`
- Tasks: columnas completas del modelo de tarea
- Ops: idempotencia por `opId`
- TaskEvents: bitácora de operaciones
- FocusSessions: sesiones de foco

## Endpoints
- `GET ?route=meta`
- `POST ?route=sync`

`route=sync` recibe body texto plano JSON con `idToken`, `clientId`, `since`, `ops`.
