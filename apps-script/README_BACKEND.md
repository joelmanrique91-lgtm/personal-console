# Backend (Apps Script + Google Sheets)

## 1) Deploy Web App
1. Abre el proyecto de Apps Script donde pegaste `Code.gs`.
2. **Implementar → Nueva implementación**.
3. Tipo: **Aplicación web**.
4. Ejecutar como: **Yo**.
5. Quién tiene acceso: **Cualquiera con el enlace**.
6. Implementa y copia la **URL del Web App**.

> Nota: la URL termina en `/exec`. Esa es la que debes usar en la app.

## 2) Auto-provision (sin crear Sheets a mano)
La primera vez que se ejecuta el Web App (por ejemplo con **Test connection** en Settings):
- Se crea automáticamente una Spreadsheet llamada **"Personal Console DB"** en el Drive del dueño del script.
- Se crean las pestañas **Tasks** y **Ops** si no existen.
- Se escriben los headers necesarios en la fila 1.
- El `spreadsheetId` se guarda en `PropertiesService` para futuras ejecuciones.

## 3) Cómo ver la Spreadsheet creada
Haz **Test connection** en la app. La respuesta `meta` incluye:
- `spreadsheetUrl`: ábrelo en el navegador para ver Tasks/Ops.

## 4) Endpoints
Todos usan el parámetro `route` en la misma URL `/exec`:
- `GET ?route=meta` → `{ ok, spreadsheetId, spreadsheetName, spreadsheetUrl, sheets, serverTime }`
- `GET ?route=tasks&since=<ISO>` → `{ ok, tasks, serverTime }`
- `POST ?route=upsert` → body `{ ops: Op[] }` → `{ ok, applied, rejected, serverTime }`

## 5) Notas
- `tags` se guarda como JSON string en Sheets.
- El acceso del Web App debe ser **Anyone with link** para el MVP (URL secreta).
