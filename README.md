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

## Por qué el túnel bloqueaba el host (y cómo se resolvió)

Vite bloquea por defecto hosts externos para evitar requests no deseados. Para desarrollo con
Cloudflare Quick Tunnel (subdominios `*.trycloudflare.com` que cambian cada vez), se habilitó
`server.allowedHosts` en `vite.config.ts` para permitir cualquier host **solo en el servidor
de desarrollo**. Esto evita el error **"Blocked request. This host is not allowed"** sin afectar
builds de producción.

## Ejecutar local + túnel (Windows)

```cmd
run_local_and_tunnel.cmd
```

Este launcher:

- Instala dependencias si faltan.
- Levanta Vite en `0.0.0.0:5173`.
- Abre el túnel con `cloudflared`.
- Muestra la URL pública `https://*.trycloudflare.com` en la ventana de Cloudflared.

Para instalar Cloudflare Tunnel:

```cmd
winget install Cloudflare.cloudflared
```

Abrí la URL del túnel en tu celular.

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
- **Blocked request**: asegurate de tener `server.allowedHosts` habilitado en `vite.config.ts`.

## Decisiones de diseño

- Se usa un store simple en React + localforage para persistencia.
- Drag & drop implementado con HTML5 para evitar dependencias extra.
- En móvil el board pasa a una columna vertical para facilitar el scroll.
