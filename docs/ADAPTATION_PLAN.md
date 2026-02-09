# Adaptation Plan — Web App “para celular”

## Requisitos objetivo (checklist)
- [ ] Mobile-first responsive (breakpoints + targets táctiles).
- [x] PWA instalable (manifest + icons + SW).
- [ ] Offline mínimo (cache de shell + datos) validado en dispositivo.
- [ ] UX móvil (navegación simple, loading/error states).
- [ ] Deploy estático (Vercel/Netlify/Cloudflare Pages).
- [ ] Running local en Windows (PowerShell) con comandos documentados.

## GAP → cambio propuesto → archivos → esfuerzo → riesgo

| GAP | Cambio propuesto | Archivos a tocar | Esfuerzo | Riesgo |
| --- | --- | --- | --- | --- |
| Responsive limitado | Rediseñar CSS mobile-first + targets táctiles | `src/styles/app.css`, componentes | M | L |
| Accesibilidad básica | Focus visible, dialog accesible, navegación teclado | `src/App.tsx`, `src/styles/app.css` | S | L |
| Offline solo para datos | Validar cache del app shell + indicadores offline | `vite.config.ts`, `src/main.tsx`, `docs/PWA_SETUP.md` | S | M |
| Import JSON sin validación | Validar tamaño y estructura | `src/App.tsx` | S | L |

## Plan por PRs/commits (numerados)
- **PR-00 Stabilize (si aparecen bugs en tests/uso real).**
  - Fixes de lint/build/test si fallan.
- **PR-01 PWA Foundation (implementado en esta rama).**
  - Manifest, íconos, SW y registro.
- **PR-02 Mobile-first layout.**
  - Reordenar layout y navegación para móviles.
- **PR-03 A11y & UX.**
  - Focus, dialog accesible, mensajes de error/carga.
- **PR-04 Offline UX.**
  - Estrategias de cache + indicadores offline.

## Criterios de aceptación / pruebas
- Instalación PWA exitosa en Chrome Android y desktop.
- App carga en offline (app shell) tras haber visitado al menos una vez.
- Targets táctiles ≥ 44px y navegación usable en 320–480px.
- Navegación con teclado (Tab/Shift+Tab) sin perder el foco.
- Build estático deployable sin ajustes extra.
