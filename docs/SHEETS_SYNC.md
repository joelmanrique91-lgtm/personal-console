# Sync con Google Sheets (modo cuenta)

## 1) Deploy backend
- Usar `apps-script/Code.gs`.
- Publicar Web App y copiar URL `/exec`.

## 2) Configurar app
1. Iniciar sesión con Google en **Configuración > Cuenta / Sync**.
2. Pegar backendUrl (`.../exec`) y guardar.
3. Presionar **Sync now**.

## 3) Dónde se guarda
- Se crea un Spreadsheet llamado **Personal Console DB** en el Drive del owner del script.
- Cada usuario queda separado por `userId` (sub de Google).

## 4) Verificación rápida
1. Crear tarea en Inbox.
2. Sync now.
3. Abrir hoja y confirmar fila en `Tasks`.

## 5) Modo sin cuenta
Sin login, la app sigue offline-first local (IndexedDB del dispositivo/navegador).
