# QA Checklist manual — Personal Console

## 1) Entrada / triage
- [ ] Crear tarea nueva sin fecha.
- [ ] Verificar que se crea con `status=backlog` y `priorityLane=P4`.
- [ ] Verificar que aparece en tab **Entrada**.
- [ ] Desde la tarjeta, asignar carril y fecha.
- [ ] Cambiar estado rápido a `in_progress`, `blocked` y `archived`.

## 2) Tablero (semántica)
- [ ] Abrir tab **Tablero**.
- [ ] Confirmar que solo existen 5 columnas: P0, P1, P2, P3, P4.
- [ ] Confirmar que no hay columnas “Bandeja”, “Bloqueado” ni “Hecho”.
- [ ] Arrastrar tarea entre columnas y verificar que cambia solo `priorityLane`.
- [ ] Marcar tarea como `done` y confirmar que desaparece por defecto.
- [ ] Activar “Mostrar hechas y archivadas” y confirmar que vuelve a verse.

## 3) Bloqueo con motivo
- [ ] En tarjeta, usar acción **Bloquear**.
- [ ] Confirmar prompt de motivo.
- [ ] Confirmar que la tarjeta muestra estado bloqueada.
- [ ] Confirmar que se completa `blockedSince` al primer bloqueo.

## 4) Foco del día
- [ ] Seleccionar tarea desde Tablero (clic tarjeta).
- [ ] Abrir tab **Foco del día** y confirmar que se mantiene la tarea seleccionada.
- [ ] Usar botón **Sugerir foco** sin tarea seleccionada.
- [ ] Verificar priorización por riesgo en P0/P1 (fallback riesgo global).
- [ ] Usar acciones rápidas: En curso, Hecha, Bloquear, mover carril, cambiar fecha.

## 5) Calendario unificado
- [ ] Abrir tab **Calendario** (única tab).
- [ ] Cambiar selector **Mes/Semana** dentro de la vista.
- [ ] Verificar que solo aparecen tareas con `dueDate`.
- [ ] Verificar que los ítems muestran etiqueta de carril (P0..P4).
- [ ] Navegar Anterior/Siguiente en ambas vistas.

## 6) Settings / sync opcional
- [ ] Ir a **Configuración** y leer bloque “¿Para qué sirve esto?”.
- [ ] Con URL vacía: confirmar aviso claro y botones de sync deshabilitados.
- [ ] Con URL cargada: confirmar habilitación de “Probar conexión”, “Enviar tarea de prueba” y “Sincronizar ahora”.
- [ ] Confirmar que la app sigue usable offline/local sin URL.

## 7) Riesgo y orden
- [ ] Crear tarea vencida y verificar banda `critical` + razón “Tarea vencida”.
- [ ] Crear tarea con vencimiento <=3 días y verificar banda `high` + razón “Vence pronto”.
- [ ] Bloquear tarea por >=3 días y verificar razón correspondiente.
- [ ] Confirmar orden en carril: riskBand desc, riskScore desc, dueDate asc (sin fecha al final).
