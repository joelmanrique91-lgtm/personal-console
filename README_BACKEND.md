# Backend (Apps Script + Google Sheets)

## 1) Crear el Spreadsheet
1. Crea un Google Spreadsheet en tu Drive.
2. Crea dos pestañas: `Tasks` y `Ops`.
3. En `Tasks` coloca esta fila de headers (fila 1):
   ```
   id,title,status,priority,stream,tags,estimateMin,plannedAt,dueAt,createdAt,updatedAt,revision,deletedAt,blockedNote,doneAt
   ```
4. En `Ops` coloca esta fila de headers (fila 1):
   ```
   opId,processedAt
   ```

## 2) Pegar el Apps Script
1. Abre **Extensiones → Apps Script**.
2. Crea un archivo `Code.gs` y pega el contenido de `apps-script/Code.gs`.
3. Guarda el proyecto.

## 3) Desplegar Web App
1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: **Cualquiera con el enlace**.
5. Implementa y copia la URL de la Web App.

## 4) URL final para la app
Guarda la URL en Settings dentro de la app.

## 5) Endpoints esperados
- `GET` `?route=tasks&since=<ISO>` → devuelve `{ tasks, serverTime }`
- `POST` `?route=upsert` → body `{ clientId, ops }` → devuelve `{ accepted, rejected, serverTime }`
- `GET` `?route=meta` → devuelve `{ ok: true, serverTime }`

### Notas / Suposiciones
- El Web App no tiene routing nativo, por eso se usa el query param `route` (y opcionalmente `pathInfo`) para distinguir endpoints.
- `tags` se guarda como JSON string en Sheets.
