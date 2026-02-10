# UX Guide — Personal Console

Personal Console es un **Trello personal** con tres ejes independientes por tarea:

1. **Prioridad temporal (Carril):** P0 Hoy, P1 Semana, P2 Mes, P3 60 días, P4 Algún día.
2. **Estado:** backlog, in_progress, blocked, done, archived.
3. **Riesgo:** score, banda (low/medium/high/critical) y motivos.

> Regla clave: mover una tarea de columna cambia solo el carril temporal. El estado se cambia dentro de la tarjeta.

## Flujo diario recomendado

1. **Entrada (Triage):** capturá tareas nuevas.
   - Sin fecha => quedan en P4.
   - Asigná carril, fecha y estado rápido desde la tarjeta.
2. **Tablero:** trabajá por carriles P0..P4.
   - Las tareas se ordenan por riesgo y vencimiento dentro de cada carril.
   - Por defecto, tareas done/archived se ocultan (activar “Mostrar hechas y archivadas” para verlas).
3. **Foco del día:** elegí una única tarea.
   - Si no sabés cuál, usar “Sugerir foco” (prioriza mayor riesgo en P0/P1).
   - Tenés acciones rápidas: En curso, Hecha, Bloquear (con motivo), mover carril y cambiar fecha.
4. **Revisión:** cerrá el día revisando completadas, bloqueadas y pendientes.
5. **Calendario:** una sola vista con selector Mes/Semana.
   - Solo muestra tareas con dueDate.

## Riesgo (qué te está costando)

El riesgo se calcula automáticamente:
- Vencida => critical (“Tarea vencida”).
- Vence en <=3 días => high.
- Bloqueada >=3 días => high.
- Sin actividad >=7 días => medium.
- Caso general => low.

La UI muestra banda y motivos para ayudarte a decidir.

## Sincronización (opcional)

En **Configuración**:
- La URL del Web App conecta con Google Sheets para sincronizar entre dispositivos.
- Sin URL, la app funciona local/offline en este navegador.
- “Probar conexión” valida endpoint.
- “Sincronizar ahora” fuerza enviar/traer cambios.
