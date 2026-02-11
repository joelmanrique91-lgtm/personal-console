# Checklist manual de verificación (Personal Console)

## Persistencia local (refresh)
- [ ] Crear 2+ tareas con `#tag`, `@contexto`, duración (`30m` / `2h`), fecha y estado.
- [ ] Presionar **F5**.
- [ ] Verificar que todas las tareas reaparecen idénticas (título, tags, contexto/stream, duración, fecha y estado).
- [ ] Verificar indicador visual de **cambios sin sincronizar** cuando hay operaciones pendientes.

## Entrada y tablero
- [ ] Crear una tarea con Enter y confirmar que el foco vuelve al input.
- [ ] Verificar que la tarea nueva aparece en **Tablero** sin tocar filtros.
- [ ] Verificar acción **Deshacer** (5s) luego de crear tarea.

## Backup local (Importar/Exportar)
- [ ] Exportar backup local (JSON) con tareas.
- [ ] Borrar/modificar una tarea local.
- [ ] Importar backup y confirmar restauración del estado.
- [ ] Verificar que botón Exportar queda deshabilitado cuando no hay tareas.

## Sync y modo offline
- [ ] En Configuración, comprobar panel simple: estado red, último sync, pendientes por subir.
- [ ] Ejecutar **Sincronizar ahora** y validar mensaje de resultado.
- [ ] Verificar botón **Ver hoja** cuando hay URL disponible.
- [ ] Activar modo offline (DevTools) y confirmar feedback de error accionable.

## Google Sheets
- [ ] Confirmar que hojas técnicas existentes siguen funcionando: `Tasks`, `Ops`, `TaskEvents`.
- [ ] Confirmar creación/actualización de `Tasks_View` con columnas amigables.
