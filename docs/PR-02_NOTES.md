# PR-02 UI Audit Notes (Mobile-first)

## Layout principal (App Shell)
- `App.tsx`: estructura base con `header`, `nav` y secciones de vista dentro de `.app` (no hay wrappers semánticos adicionales). Faltan ajustes mobile-first en layout y spacing para header/nav/main. 
- `src/styles/app.css`: estilos globales usan padding y layout desktop por defecto (header/nav en fila, grid de 6 columnas), lo que provoca densidad alta y riesgo de overflow horizontal en móvil.

## Controles críticos
- Header actions: botones `Ctrl+K`, `Export` y `Import` tienen padding reducido (8px/12px) y altura inferior a 44px.
- Nav buttons (tabs): padding reducido, sin altura mínima; en móvil pueden quedar muy juntos.
- Task input: input y botón con padding 12px, pero la fila en una sola línea puede desbordar en pantallas estrechas.
- Task cards: botones de acciones con padding pequeño, múltiples acciones en fila.
- Filters: selects con layout en una sola línea y sin tamaño táctil mínimo.
- Focus timer/review actions: botones y grupos de acciones sin wrap ni spacing suficiente.
- Palette: items y acciones con botones pequeños y layout en una sola línea.

## Problemas detectados (mobile)
- Overflow horizontal: `.board` usa `grid-template-columns: repeat(6, minmax(200px, 1fr))` y `overflow-x: auto`, lo que obliga scroll horizontal y rompe single-column.
- Densidad excesiva en header/nav y en filtros/acciones.
- Tipografía base no define 16px ni line-height confortable.
- Sin safe-area bottom padding.
- :focus-visible no está definido; :active sin feedback en mobile.

## Archivos involucrados
- `src/styles/app.css` (principal para layout/touch targets/tipografía/estados)
- `src/App.tsx` (estructura de header/nav/views; evaluar wrappers semánticos si hace falta)
- `src/components/*` (TaskInput, Filters, TaskCard, FocusTimer, ReviewSummary para clases/estructura existente)

## Propuesta de solución (UI only)
- Rehacer estilos base a mobile-first en `app.css`: header/nav/sections en columna, spacing generoso, nav con scroll horizontal y wrap.
- Ajustar inputs/buttons/selects a altura mínima 44px y padding suficiente.
- Definir font-size base 16px y line-height 1.5.
- Añadir `env(safe-area-inset-bottom)` en contenedores principales.
- Añadir estilos `:focus-visible` y `:active` para feedback.
- Usar media queries >=768 y >=900 para restaurar layout desktop y grid de 6 columnas.
- Mantener JSX intacto salvo wrappers semánticos si CSS no alcanza (idealmente no tocar lógica).
