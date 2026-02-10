# QA Checklist

## Empty states
- [ ] Entrada muestra: “No hay tareas nuevas. Capturá una arriba o importá un archivo.” cuando no hay backlog.
- [ ] Tablero muestra: “No hay tareas con este filtro.” cuando filtros devuelven 0.
- [ ] Calendario muestra estado vacío cuando no hay tareas con fecha.
- [ ] Revisión muestra “Todo bajo control hoy ✅” cuando no existen alertas.

## Foco
- [ ] Se puede fijar foco desde una tarjeta del tablero con 🎯.
- [ ] “Sugerir foco” pide confirmación si ya había foco.
- [ ] Selector “Cambiar foco” permite búsqueda y reemplazo.

## Detalle de tarea
- [ ] Editar lane/status/dueDate/effort/tags persiste al recargar.
- [ ] Si status=blocked, exige motivo y muestra “bloqueada desde”.
- [ ] Riesgo y reasons se ven en modo read-only.
- [ ] Borrar solicita confirmación irreversible.

## Límites por carril
- [ ] Header muestra “Al límite” cuando count == limit.
- [ ] Header muestra “Sobrecargado” cuando count > limit.
- [ ] Mover a P0/P1 bloquea si excede límite y muestra mensaje de guía.
- [ ] Configuración guarda límites P0..P4 en storage local.

## Revisión
- [ ] Alertas accionables listan: vencidas, <=72h, bloqueadas, sin actividad, carriles sobre límite.
- [ ] Cada alerta tiene links clickeables al detalle de tarea.
