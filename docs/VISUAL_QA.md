# Visual QA Checklist

## Breakpoints
- Mobile: **375x812**
- Desktop: **1440x900**

## Checklist por pantalla
### Entrada
- Composer alineado (input + CTA).
- Empty state visible y claro.
- Tags/atajos legibles.

### Tablero
- Navegación superior tipo segmented control (estado activo claro).
- 5 columnas en desktop, sin ruptura en mobile.
- Headers de columna con contador y estado (al límite/sobrecargado).
- Cards con: título, estado, riesgo, fecha, tags, acciones.
- Drag & drop: columna destino resaltada.

### Foco
- Hero card con barra de riesgo.
- CTA principal/secondary visibles.
- Timer usable con teclado.

### Revisión
- Métricas como tarjetas compactas con icono.
- Alertas con chips/cantidad y navegación a tarea.

### Calendario
- Mes: celdas limpias, día legible, tareas en chip.
- Semana: headers claros + empty copy consistente.

### Configuración
- Secciones visualmente separadas.
- Jerarquía de sync: “Sincronizar ahora” y “Probar conexión”.

## Estados a validar
- Vacío, muchas tareas, riesgo alto, bloqueadas.
- Hover/focus/disabled consistente.
- Targets táctiles >= 44x44.
- Overflow controlado en nav/tags/títulos largos.

## Accesibilidad rápida
- Navegación con teclado (Tab + Enter + Esc).
- `focus-visible` siempre perceptible.
- Contraste suficiente para textos muted.

## Capturas sugeridas
1. Header + nav (desktop).
2. Entrada vacía y con tareas.
3. Tablero con columnas llenas y drag-over.
4. Foco del día con barra de riesgo.
5. Revisión con alertas.
6. Calendario (mes y semana).
7. Configuración con panel de sync.
