# Deploy Apps Script backend

1. Abrí Apps Script en tu cuenta Google.
2. Pegá el contenido de `Code.gs`.
3. Deploy > New deployment > Web app.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Copiá la URL que termina en `/exec`.

## Endpoints

- `GET ?route=meta` → metadata del spreadsheet y `spreadsheetUrl`.
- `POST ?route=sync` (texto plano JSON):

```json
{
  "workspaceKey": "joel-main",
  "clientId": "uuid",
  "since": "2026-01-01T00:00:00.000Z",
  "ops": []
}
```

No usa tokens de login ni validación contra Google OAuth.
