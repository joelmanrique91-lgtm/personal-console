# IMPLEMENTATION_PLAN.md

## Plan de mejora para **Personal Console** (alineación con Prioridad + Estado + Riesgo)

> Documento de implementación propuesto tras inspección del repositorio actual. Incluye auditoría técnica, rediseño de dominio, motor de riesgo, UI, migración y validación.

---

## 0) Supuestos y límites declarados

1. Se mantiene el stack actual: **React + TypeScript + Vite** con estado global en Context/Reducer y persistencia local con **localforage (IndexedDB)**.
2. El backend sigue siendo **Google Apps Script + Google Sheets** y ya soporta `meta/tasks/upsert`; se extenderá de forma retrocompatible.
3. No se reemplaza la arquitectura completa (sin Redux, sin backend nuevo): el plan prioriza refactor incremental para evitar romper el modo offline.
4. Donde falte definición funcional exacta (p. ej. pesos de riesgo), se proponen defaults configurables en Settings.

---

## 1) Auditoría del estado actual del repositorio

## 1.1 Framework, estructura y componentes

- **Entrada y shell de app:** `src/main.tsx`, `src/App.tsx`.
- **Vistas actuales dentro de App (sin router):** Bandeja, Tablero, Enfoque, Revisión, Calendario Mes, Calendario Semana, Settings.
- **Componentes relevantes:**
  - `TaskCard`, `BoardColumn`, `TaskInput`, `Filters`
  - `FocusTimer`, `ReviewSummary`
  - `CalendarMonth`, `CalendarWeek` (separados)
- **Problema observado:** el tablero usa columnas por `status` (`inbox/today/week/someday/blocked/done`), mezclando prioridad temporal con estado operativo.

## 1.2 Modelo de datos actual

`Task` actual:
- `status` mezcla conceptos de carril y estado (`inbox`, `today`, `week`, `someday`, `blocked`, `done`).
- Tiene `priority` (low/med/high) y `stream`, pero **no** existe `PriorityLane` P0–P4.
- Tiene `estimateMin`, `plannedAt`, `dueAt`, `blockedNote`, `revision`, `deletedAt`, etc.
- No hay `riskScore` persistido ni motivos de riesgo.

## 1.3 Offline-first / sync actual

- Persistencia local en localforage (`tasks_cache`, `ops_queue`, `sync_state`, `sync_settings`, etc.).
- Cola de operaciones (`upsert`/`delete`) con `opId` + compactación por `taskId`.
- Motor de sync:
  - Push de cola en lotes.
  - Pull incremental por `since`.
  - Resolución de conflicto por `revision` y `updatedAt`.
- Backend Apps Script:
  - Sheets `Tasks` y `Ops`.
  - Idempotencia básica por `opId` procesado.

## 1.4 Gaps funcionales contra la lógica objetivo

1. No existen carriles P2/P3.
2. Bandeja/Bloqueado/Hecho aparecen como columnas de tablero (deberían ser estado o flujo de entrada).
3. No hay límites WIP reales por carril P0/P1.
4. No hay motor de riesgo ni orden por riesgo.
5. Enfoque no muestra diagnóstico de riesgo de la tarea seleccionada.
6. Mes/Semana están separados en dos vistas/componentes.
7. Settings no explica claramente la URL del Web App ni expone controles de reglas (límites/pesos/alertas).

---

## 2) Objetivo funcional a implementar

Separar de forma explícita y obligatoria los tres ejes:

- **Prioridad temporal (Lane):** `P0 Hoy`, `P1 Semana`, `P2 2-4 semanas`, `P3 60 días`, `P4 Algún día`.
- **Estado:** `Backlog`, `En curso`, `Bloqueada`, `Hecha`, `Archivada`.
- **Riesgo:** score calculado + banda + motivos + alertas.

Reglas duras:
1. Cualquier tarea sin fecha de vencimiento debe quedar en `P4`.
2. P0/P1 con límite configurable y control al exceder.
3. Vencidas / por vencer deben escalar visibilidad.
4. Bloqueo prolongado debe generar alertas activas.

---

## 3) Refactor del modelo de datos

## 3.1 Nuevo contrato `Task`

```ts
type PriorityLane = "P0" | "P1" | "P2" | "P3" | "P4";
type Status = "backlog" | "in_progress" | "blocked" | "done" | "archived";

type RiskBand = "low" | "medium" | "high" | "critical";

interface Task {
  id: string;
  title: string;
  description?: string;

  // Eje 1
  priorityLane: PriorityLane;

  // Eje 2
  status: Status;

  // Tiempo y esfuerzo
  dueDate?: string;          // ISO
  effort?: number;           // puntos o minutos (definir unidad única)

  // Trazabilidad
  createdAt: string;
  updatedAt: string;
  lastTouchedAt: string;

  // Bloqueo
  blockedSince?: string;
  blockedReason?: string;

  // Clasificación
  tags: string[];

  // Sync/versionado
  revision: number;
  deletedAt?: string;        // tombstone

  // Riesgo calculado (cacheado)
  riskScore?: number;
  riskBand?: RiskBand;
  riskReasons?: string[];
}
```

## 3.2 Defaults y reglas de integridad

- `status` por defecto: `backlog`.
- `priorityLane` por defecto:
  - `P4` si `dueDate` es null/undefined.
  - si hay `dueDate`, se asigna lane sugerido por proximidad (ver regla en sección 4).
- Al pasar a `blocked`: set `blockedSince` si estaba vacío.
- Al salir de `blocked`: limpiar `blockedSince`/`blockedReason` o mantener histórico según decisión (recomendado mantener sólo campo activo + eventos en log).
- `lastTouchedAt` se actualiza en cualquier cambio semántico.

## 3.3 Índices necesarios en IndexedDB/localforage

Como localforage no expone índices relacionales, definir **índices lógicos en memoria** + persistencia optimizada por claves:

- `tasks_by_id` (mapa principal).
- `tasks_by_lane` (P0..P4) para tablero.
- `tasks_by_status` para filtros y review.
- `tasks_by_dueDate` para calendario y alertas.
- `tasks_by_risk` (derivado, no persistencia obligatoria).

Si se migra a Dexie en fase futura:
- PK: `id`
- índices: `[priorityLane+status]`, `dueDate`, `updatedAt`, `lastTouchedAt`, `blockedSince`, `deletedAt`, `revision`.

## 3.4 Control de versiones y tombstones

- Mantener `revision` incremental por tarea.
- Borrado lógico vía `deletedAt` (no hard delete en cliente ni servidor).
- Mantener `schemaVersion` en almacenamiento local y en backend (`meta`).
- Cada migración debe ser idempotente (`if already migrated -> skip`).

---

## 4) Motor de riesgo (risk engine)

## 4.1 Variables de entrada

- Días a vencimiento (`daysToDue`)
- `effort`
- Días bloqueada (`daysBlocked`)
- Días sin tocar (`daysStale` desde `lastTouchedAt`)
- Sobrecarga del carril (`laneLoad / laneLimit`)

## 4.2 Fórmula propuesta (configurable por pesos)

```ts
function calcRisk(task, laneStats, cfg, now): RiskResult {
  if (task.status === "done" || task.status === "archived" || task.deletedAt) {
    return { score: 0, band: "low", reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1) Vencimiento
  if (!task.dueDate) {
    score += cfg.noDuePenalty; // bajo, pero no cero
    reasons.push("Sin fecha de vencimiento (debe vivir en P4)");
  } else {
    const d = daysBetween(now, task.dueDate);
    if (d < 0) { score += cfg.overdueBase + Math.min(Math.abs(d) * cfg.overduePerDay, cfg.overdueCap); reasons.push("Tarea vencida"); }
    else if (d <= 1) { score += cfg.dueIn1d; reasons.push("Vence en ≤ 1 día"); }
    else if (d <= 3) { score += cfg.dueIn3d; reasons.push("Vence en ≤ 3 días"); }
    else if (d <= 7) { score += cfg.dueIn7d; reasons.push("Vence esta semana"); }
  }

  // 2) Esfuerzo
  if (task.effort && task.effort >= cfg.highEffortThreshold) {
    score += cfg.highEffortPenalty;
    reasons.push("Esfuerzo alto");
  }

  // 3) Bloqueo
  if (task.status === "blocked" && task.blockedSince) {
    const b = daysBetween(task.blockedSince, now);
    score += Math.min(cfg.blockedBase + b * cfg.blockedPerDay, cfg.blockedCap);
    reasons.push(`Bloqueada hace ${b} días`);
  }

  // 4) Estancamiento
  const s = daysBetween(task.lastTouchedAt, now);
  if (s >= cfg.staleDays) {
    score += Math.min((s - cfg.staleDays + 1) * cfg.stalePerDay, cfg.staleCap);
    reasons.push(`Sin actividad hace ${s} días`);
  }

  // 5) Sobrecarga de carril
  const lane = laneStats[task.priorityLane];
  if (lane.limit > 0 && lane.count > lane.limit) {
    const overloadRatio = (lane.count - lane.limit) / lane.limit;
    score += Math.min(cfg.overloadBase + overloadRatio * cfg.overloadFactor, cfg.overloadCap);
    reasons.push(`Carril ${task.priorityLane} sobrecargado`);
  }

  const band = score >= cfg.bandCritical ? "critical"
            : score >= cfg.bandHigh ? "high"
            : score >= cfg.bandMedium ? "medium"
            : "low";

  return { score: round(score, 1), band, reasons };
}
```

## 4.3 Bandas de riesgo (default)

- `low`: 0–24
- `medium`: 25–49
- `high`: 50–74
- `critical`: 75+

## 4.4 Reglas de alerta

- **Alerta vencida:** inmediata, prioridad máxima.
- **Alerta por vencer:** dentro de 72h.
- **Alerta bloqueo prolongado:** `blockedSince >= 3 días` (configurable).
- **Alerta estancamiento:** `lastTouchedAt >= 7 días`.
- **Alerta sobrecarga:** carril supera límite.

## 4.5 Orden en tablero por carril

Dentro de cada columna P0..P4:
1. `riskBand` (critical > high > medium > low)
2. `riskScore` descendente
3. `dueDate` más cercana primero (sin fecha al final)
4. `updatedAt` más antigua primero (para visibilizar abandono)

---

## 5) Rediseño de tablero y semántica de estados

## 5.1 Tablero = solo carriles de prioridad

- Columnas horizontales fijas: `P0`, `P1`, `P2`, `P3`, `P4`.
- Eliminar columnas actuales que mezclan conceptos: “Bandeja”, “Bloqueado”, “Hecho”.
- Cada tarjeta muestra:
  - título
  - fecha con semáforo (rojo/amarillo/verde/gris sin fecha)
  - esfuerzo
  - tags
  - icono/chip de estado (`backlog/in_progress/blocked/done/archived`)
  - banda o score de riesgo

## 5.2 Límites configurables por carril (WIP)

Defaults sugeridos:
- P0: 5
- P1: 12
- P2: 20
- P3: 30
- P4: sin límite (0 = ilimitado)

Comportamiento:
- Mostrar `count/limit` en header de columna.
- Si `count > limit`: columna con estilo de sobrecarga + alerta en Review.
- En P0/P1, bloquear creación/movimiento cuando excede límite (permitir bypass sólo con confirmación explícita “Forzar por riesgo crítico”).

## 5.3 Bandeja (Backlog/Input Queue)

Definición:
- “Bandeja” deja de ser carril del tablero.
- Es una **vista de captura y triage** de tareas nuevas (`status=backlog`) pendientes de planificación.
- Acciones en Bandeja:
  - asignar `dueDate`
  - asignar `priorityLane`
  - mover a `in_progress`
  - enviar a `P4` si no hay fecha

## 5.4 Bloqueado como estado (no columna)

- `status = blocked` + `blockedSince` + `blockedReason` obligatorio.
- Desbloquear = cambio de estado a `backlog` o `in_progress` y limpieza/registro del bloqueo.
- Alertas:
  - warning a partir de N días bloqueada.
  - crítico a partir de N2 días.

---

## 6) Vista Enfoque, Revisión y Calendario unificado

## 6.1 Vista **Enfoque** (panel contextual)

Trigger: seleccionar tarjeta del tablero.

Contenido mínimo:
- título + descripción
- `effort`, `priorityLane`, `status`, `dueDate`
- `riskScore` + `riskBand`
- lista de `riskReasons`
- alertas activas

Acciones rápidas:
- cambiar estado
- marcar/desmarcar bloqueada
- reprogramar `dueDate`
- mover carril
- archivar

## 6.2 Vista **Revisión**

Métricas diarias:
- tareas vencidas
- tareas por vencer 72h
- bloqueadas prolongadas
- estancadas
- completadas hoy
- sobrecarga por carril

Acciones:
- “Mover pendientes críticos a P0/P1” (respetando límites)
- “Reasignar sin fecha a P4”
- “Descongestionar P0/P1” (sugerencia a P2/P3)

## 6.3 Componente único **Calendario**

Crear `Calendario` con selector `Mes | Semana` en un mismo componente.

- Renderiza sólo tareas con `dueDate`.
- Colorea o etiqueta por `priorityLane`.
- Permite drag/drop para cambiar `dueDate`.
- Mantiene consistencia de lane sugerido tras cambio de fecha.

---

## 7) Replanteo de Settings

## 7.1 Mensajería y ayuda

Explicar en UI:
- **URL del Web App:** endpoint de Google Apps Script que sincroniza tareas entre dispositivos usando Google Sheets.
- **Test connection:** valida acceso a `route=meta` y muestra diagnóstico.
- **Send TEST task:** envía una tarea de prueba para verificar escritura.
- **Sync now:** fuerza push/pull inmediato de cambios pendientes.

## 7.2 Controles nuevos

Agregar paneles para:
1. Límites por carril (P0..P4).
2. Pesos del motor de riesgo.
3. Frecuencia de alertas/notificaciones.
4. Umbrales de bloqueo/estancamiento.

## 7.3 Estado de sync comprensible

Mostrar:
- Online/Offline
- Última sync exitosa (hora local)
- Ops pendientes (cantidad)
- Errores recientes de sync
- Conflictos resueltos (contador)

---

## 8) Estrategia de migración de datos existentes

## 8.1 Mapeo de esquema actual -> nuevo

- `status: inbox` -> `status: backlog`, `priorityLane: P4` (si no dueDate)
- `status: today` -> `priorityLane: P0`, `status: in_progress` (o backlog según heurística)
- `status: week` -> `priorityLane: P1`, `status: in_progress|backlog` según uso actual
- `status: someday` -> `priorityLane: P4`, `status: backlog`
- `status: blocked` -> `status: blocked`, `priorityLane` inferida por `dueAt` o fallback P2
- `status: done` -> `status: done`, lane conservado o inferido por due

Conversión campos:
- `dueAt` -> `dueDate`
- `estimateMin` -> `effort` (unidad temporal)
- `blockedNote` -> `blockedReason`
- `updatedAt` -> `lastTouchedAt` si faltara

## 8.2 Reglas de backfill

- Tarea sin `dueDate`: forzar `priorityLane = P4`.
- Si no hay `blockedSince` y `status=blocked`: usar `updatedAt`.
- Si faltan `createdAt/updatedAt`: usar timestamp de migración.

## 8.3 Migración por versiones

- `schemaVersion: 1 -> 2` (nuevo dominio).
- Script de migración idempotente en `src/store/migrations`.
- Después de migrar:
  - recalcular riesgo de todas las tareas
  - encolar upserts para sincronizar esquema nuevo al backend

---

## 9) Offline-first + sincronización (idempotencia y conflictos)

## 9.1 Cola de operaciones

Operaciones sugeridas:
- `UPSERT_TASK`
- `DELETE_TASK` (tombstone)
- opcional: `PATCH_TASK_FIELDS`

Campos por op:
- `opId` UUID
- `taskId`
- `type`
- `payload`
- `createdAt`
- `baseRevision`
- `retryCount`

Idempotencia:
- servidor guarda `opId` procesados (ya existe hoja Ops)
- reintentos con mismo `opId` no duplican efectos

## 9.2 Resolución de conflictos

Política mínima:
1. Comparar `revision`.
2. Si empatan, comparar `updatedAt`.
3. Si persiste empate raro: preferir server + registrar conflicto.

Además:
- guardar log de conflictos para debugging.
- exponer contador en Settings.

## 9.3 Contrato backend Apps Script (extensión)

Mantener rutas existentes + retrocompatibilidad:
- `GET ?route=meta`
- `GET ?route=tasks&since=...`
- `POST ?route=upsert`

Cambios:
- ampliar columnas de `Tasks` para nuevos campos (`priorityLane`, `description`, `effort`, `blockedSince`, `blockedReason`, `lastTouchedAt`, `riskScore`, `riskBand`, `riskReasons`, `schemaVersion` opcional).
- soportar lectura de filas viejas con defaults.

---

## 10) Plan por fases con criterios de aceptación y pruebas

## Fase 1 — Auditoría y contrato (1–2 días)

Entregables:
- ADR corta de dominio (3 ejes independientes).
- Tipos `Task`, `PriorityLane`, `Status` definidos.
- Documento de mapping de migración validado.

Aceptación:
- Se aprueba contrato de datos y reglas de negocio.

Pruebas:
- unit: validadores de enums/defaults.

## Fase 2 — Refactor modelo + migraciones (2–3 días)

Entregables:
- Nuevo modelo en `store/types`.
- Migración v2->v3 idempotente.
- Adaptación de storage/sync payload.

Aceptación:
- Datos antiguos abren sin pérdida.
- Todas las tareas quedan con lane y estado válidos.

Pruebas:
- unit migración:
  - mapea `today/week/someday` correctamente
  - fuerza P4 sin `dueDate`
  - conserva `revision/deletedAt`

## Fase 3 — Motor de riesgo y alertas (2 días)

Entregables:
- `riskEngine.ts` puro y testeable.
- cálculo de score/banda/motivos.
- sorting por riesgo en carriles.

Aceptación:
- vencidas y bloqueadas prolongadas aparecen primero.
- bandas de riesgo consistentes con casos de prueba.

Pruebas:
- unit:
  - overdue > dueSoon > normal
  - blocked 5 días sube score
  - stale + overload incrementan score
  - done/archived => score 0

## Fase 4 — Tablero P0–P4 + límites (2–4 días)

Entregables:
- Board columnas sólo por lane.
- chips de estado en tarjetas.
- control de límites WIP configurable.

Aceptación:
- existen P2 y P3 visibles.
- no existe columna Bloqueado/Hecho/Bandeja en tablero.
- bloqueo de nuevas tarjetas cuando P0/P1 exceden límite.

Pruebas:
- e2e drag/drop:
  - mover a P0 cuando límite lleno => bloquea con mensaje
  - mover a P2 con límite lleno => warning configurable

## Fase 5 — Enfoque + Revisión + Calendario unificado (3–4 días)

Entregables:
- Enfoque con panel de riesgo y acciones rápidas.
- Review con métricas diarias + replanificación.
- nuevo `Calendario` (selector mes/semana).

Aceptación:
- seleccionar tarjeta muestra diagnóstico de riesgo.
- calendario único renderiza ambos modos.

Pruebas:
- e2e:
  - selección en board abre detalle enfoque
  - cambio de fecha en calendario impacta lane/riesgo

## Fase 6 — Settings y UX de sync (1–2 días)

Entregables:
- texto explicativo claro de URL Web App y botones.
- controles de límites/pesos/frecuencia.
- estado de sync entendible.

Aceptación:
- usuario comprende para qué sirve cada acción de sync.
- se visualiza estado online/offline y pendientes.

Pruebas:
- e2e con mocks API:
  - test connection OK/FAIL
  - sync now consume cola

## Fase 7 — Hardening, QA y rollout (2 días)

Entregables:
- suite mínima unit + e2e.
- checklist de regresión offline.
- plan de rollout por feature flags simples.

Aceptación:
- app usable offline con sync diferido.
- migraciones y conflictos estables.

Pruebas críticas finales:
1. **Límites P0/P1**
2. **Orden por riesgo por carril**
3. **Alertas de bloqueo prolongado**
4. **Migración desde esquema viejo**
5. **Sync idempotente reintentable**

---

## 11) Stubs y verificación en 5 minutos (si faltara backend/config)

Si no hay Apps Script desplegado o hay dudas de contrato:

1. Crear mock local rápido (`npm run dev`) con MSW o endpoint fake para:
   - `GET /meta`
   - `GET /tasks?since=`
   - `POST /upsert`
2. Simular:
   - respuesta OK
   - conflicto (`rejected` con `serverTask`)
   - timeout/offline
3. Verificar en 5 minutos:
   - `Sync now` procesa cola
   - contador de pendientes baja
   - conflicto se resuelve y queda registrado

Checklist express (manual):
- crear tarea sin `dueDate` => cae en P4
- mover 6 tareas a P0 con límite 5 => bloqueo
- marcar tarea como bloqueada + 4 días => alerta visible
- tarea vencida aparece arriba de su carril

---

## 12) Resultado esperado al finalizar

- Tablero coherente por prioridad temporal (P0–P4).
- Estado desacoplado de carril.
- Riesgo visible, explicable y accionable por tarea.
- Bandeja como captura/triage, no carril.
- Bloqueado como estado con semántica completa.
- Calendario único mes/semana.
- Settings entendible para sync + reglas.
- Migración segura desde esquema actual.
- Offline-first robusto con idempotencia y conflictos controlados.
