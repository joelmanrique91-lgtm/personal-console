# QA Checklist manual

## Flujo principal
- [ ] Crear tarea sin fecha desde Entrada -> queda en `P4` y visible en Entrada.
- [ ] Mover tarjeta entre P0..P4 con drag & drop -> cambia `priorityLane`.
- [ ] Bloquear tarea -> pide motivo y muestra badge `Bloqueada`.
- [ ] Marcar `Hecha` -> deja de verse en tablero por defecto.
- [ ] Abrir Enfoque sin tarea activa -> botón **Sugerir foco** selecciona una tarea.

## Navegación y claridad
- [ ] Existe una sola pestaña **Calendario** con selector Mes/Semana.
- [ ] Entrada explica que sirve para captura/triage.
- [ ] Tablero explica que columnas son prioridad temporal.
- [ ] Settings explica claramente la URL del Web App.

## Settings / sync
- [ ] Sin URL, botones de sync están deshabilitados y aparece mensaje de ayuda.
- [ ] Con URL, se habilitan **Probar conexión**, **Enviar tarea de prueba**, **Sincronizar ahora**.
- [ ] Se muestra `Estado`, `Último sync` y `Ops pendientes`.

## Offline-first
- [ ] Con DevTools en Offline, se pueden crear/mover tareas localmente.
- [ ] Al volver online y con URL configurada, `Sincronizar ahora` procesa cola.
