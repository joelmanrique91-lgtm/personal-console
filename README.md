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
npm run dev
```

La app corre en `http://localhost:5173`.

## Ejecutar local + túnel (Windows)

```cmd
run_local_and_tunnel.cmd
```

Esto levanta Vite en `0.0.0.0:5173` y abre un túnel con `cloudflared` (quick tunnel). En la consola vas a ver la URL pública para abrir desde el celular.

## (Opcional) Ejecutar con Python

```bash
python run_local_and_tunnel.py
```

Si `cloudflared` no está instalado, el script imprime instrucciones.

## Funcionalidad

- **Inbox** con captura rápida y atajos: `@contexto`, `#tag`, `!alta/!media/!baja`, `~10m`.
- **Board** con drag & drop, filtros por stream/prioridad y warning en “Hoy” si hay más de 5 tareas.
- **Focus** con timer simple, registro de sesiones y bloqueo con nota obligatoria.
- **Review** con métricas diarias y acciones rápidas.
- **Command palette** (Ctrl+K) con búsqueda instantánea y acciones rápidas.
- **Export/Import** de JSON con merge por `id`.
- Persistencia offline con IndexedDB (localforage).

## Troubleshooting

- **Puerto ocupado**: cambiá el puerto en `vite.config.ts` y en los scripts/launcher.
- **Firewall Windows**: permití Node.js y cloudflared para conexiones entrantes.
- **cloudflared no encontrado**: instalá con `winget` o `choco`.

## Decisiones de diseño

- Se usa un store simple en React + localforage para persistencia.
- Drag & drop implementado con HTML5 para evitar dependencias extra.
- En móvil el board pasa a una columna vertical para facilitar el scroll.
