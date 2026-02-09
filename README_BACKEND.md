# Backend (Apps Script + Google Sheets)

## 1) Pegar el Apps Script
1. Abre **Extensiones → Apps Script** en Google Drive.
2. Crea un archivo `Code.gs` y pega el contenido de `apps-script/Code.gs`.
3. Guarda el proyecto.

## 2) Desplegar Web App
1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: **Cualquiera con el enlace**.
5. Implementa y copia la URL del Web App (`/exec`).

## 3) Auto-provision (sin crear Sheets a mano)
La primera vez que se ejecuta el Web App (por ejemplo con **Test connection** en Settings):
- Se crea automáticamente una Spreadsheet llamada **"Personal Console DB"** en el Drive del dueño del script.
- Se crean las pestañas **Tasks** y **Ops** si no existen.
- Se escriben los headers necesarios en la fila 1.
- El `spreadsheetId` se guarda en `PropertiesService` para futuras ejecuciones.

## 4) Ver la Spreadsheet
En Settings, usa **Test connection**. La respuesta `meta` incluye `spreadsheetUrl`.

## 5) Endpoints esperados
- `GET` `?route=meta` → `{ ok, spreadsheetId, spreadsheetName, spreadsheetUrl, sheets, serverTime }`
- `GET` `?route=tasks&since=<ISO>` → `{ ok, tasks, serverTime }`
- `POST` `?route=upsert` → body `{ ops }` → `{ ok, applied, rejected, serverTime }`

### Notas
- `tags` se guarda como JSON string en Sheets.
- El acceso del Web App debe ser **Anyone with link** para el MVP.
