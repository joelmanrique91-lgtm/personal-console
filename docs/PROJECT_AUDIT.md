# Project Audit — personal-console

## Resumen ejecutivo (10 líneas)
1) El proyecto es una SPA en React + Vite + TypeScript orientada a productividad personal (Inbox/Board/Focus/Review). 
2) La persistencia es local (IndexedDB via localforage) y funciona offline para datos. 
3) Se agregó base PWA (manifest + service worker con VitePWA) para instalabilidad y app shell cache. 
4) No hay routing por URL; la navegación es por estado interno en `App.tsx`. 
5) El diseño es responsive básico con un solo breakpoint; no es mobile-first. 
6) El build es estático y apto para hosting en Vercel/Netlify/Cloudflare Pages. 
7) No hay tests automatizados configurados; sí hay lint y build. 
8) Import/Export JSON está presente pero con validación mínima. 
9) Accesibilidad básica tiene gaps (focus, modal palette sin focus trap). 
10) No se detectan APIs externas ni backend; todo es client-side.

## Stack & arquitectura
- **Framework/UI:** React 18.
- **Build/Bundler:** Vite 5.
- **Lenguaje:** TypeScript.
- **Estado:** React Context + `useReducer`.
- **Persistencia:** localforage (IndexedDB).
- **PWA:** `vite-plugin-pwa` con manifest + service worker.
- **Estilos:** CSS global en `src/styles/app.css`.
- **Entrada:** `index.html` + `src/main.tsx`.
- **Package manager:** npm (con `package-lock.json`).

## Cómo correr local (PowerShell) y comandos exactos
Comandos ejecutados y verificados en esta pasada:

```powershell
npm ci
npm run dev
```

Build/preview:

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Mapa de pantallas / rutas
- **Inbox:** captura rápida y listado de tareas.
- **Board:** tablero con columnas por estado y drag & drop.
- **Focus:** timer y bloqueo de tarea.
- **Review:** resumen diario.

La navegación se controla por estado `view` en `App.tsx` (sin URLs).

## Persistencia / estado / APIs
- **Estado:** `AppState` con `tasks`, `focusSessions` y `activeTaskId`.
- **Persistencia:** IndexedDB (localforage) con clave `personal-console-state`.
- **APIs externas:** no se detectan.
- **Import/Export:** JSON local con merge por `id`.

## Findings from executed checks
- **npm ci:** OK. Advertencias: `Unknown env config "http-proxy"`, 2 vulnerabilidades moderadas reportadas por npm.
- **npm run lint:** OK.
- **npm run build:** OK (incluye generación de `dist/sw.js` y `dist/manifest.webmanifest`).
- **npm run preview:** OK (servidor en `http://localhost:4173/`).
- **Navegación básica:** verificación limitada a `curl` (sin UI interactiva en este entorno).

## Hallazgos críticos (P0/P1/P2)

**P1 — Responsive/mobile-first insuficiente.**
Existe un único breakpoint; navegación y layout están más orientados a desktop.

**P1 — Accesibilidad básica incompleta.**
No hay focus trap en el command palette ni estilos de foco visibles.

**P2 — Persistencia sin versionado/migraciones.**
Los cambios futuros de esquema pueden romper datos persistidos.

**P2 — Importación JSON sin validación robusta.**
No se valida tamaño ni estructura profunda del JSON.
