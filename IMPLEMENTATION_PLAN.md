# Plan de Implementación — Personal Console (ejes independientes + riesgo + offline/sync)

> **Objetivo**: corregir la app para que cumpla **exactamente** la lógica de tres ejes independientes (Prioridad/Lane, Estado y Riesgo), con límites estrictos en P0/P1, alertas justificadas y sincronización offline-first con Google Sheets (Apps Script).

---

## 1) Resumen ejecutivo (10–20 líneas)

Hoy la app mezcla **prioridad temporal**, **estado** y **bloqueo** en un mismo eje (“columnas del tablero”), lo cual rompe la lógica objetivo y dificulta aplicar límites reales de capacidad. El riesgo no existe como motor explícito; sólo hay una alerta simple por “Hoy > 5”.

El plan propone separar **tres ejes independientes**:
- **Prioridad/Lane** (P0..P4) como carriles temporales con límites y WIP.
- **Estado** (Backlog/En curso/Bloqueada/Hecha/Archivada) como situación operativa.
- **Riesgo** como score + reglas que ordena dentro del carril y genera alertas justificadas.

Se rediseña el **Tablero** para que sus columnas sean **P0..P4** y el **estado** se vea como chips/flags o filtros, manteniendo independencia. Se introduce un **Risk Engine** determinista, con razones legibles y acciones recomendadas. Se actualiza el modelo de datos, la migración, el sync offline-first (IndexedDB/localforage + cola de ops), y el contrato del Apps Script Web App para soportar los nuevos campos.

Al final, la UI no pregunta “qué querés hacer”: **muestra qué estás arriesgando** si no actuás. Las vencidas y bloqueadas suben de visibilidad, P0/P1 no crecen sin control, y la revisión diaria refleja sobrecarga y estancamiento con acciones.

---

## 2) Definición de dominio (modelo de datos)

### 2.1 Entidad `Task`

**Campos obligatorios**
- `id: string` — UUID estable.
- `title: string`
- `priorityLane: "P0"|"P1"|"P2"|"P3"|"P4"`
- `status: "backlog"|"in_progress"|"blocked"|"done"|"archived"`
- `createdAt: string` (ISO)
- `updatedAt: string` (ISO)
- `lastTouchedAt: string` (ISO)
- `revision: number` (incremental)
- `isDeleted: boolean` **o** `deletedAt?: string`

**Campos opcionales**
- `description?: string`
- `tags: string[]`
- `effort?: number` (minutos o puntos, definir)
- `dueDate?: string` (ISO; fecha límite)
- `scheduledDate?: string` (ISO; planificación explícita)
- `blockedSince?: string` (ISO)
- `blockedNote?: string`
- `doneAt?: string`
- `archivedAt?: string`
- `stream?: string` (si se mantiene “Área”)
- `source?: "local"|"import"|"sync"`

**Defaults**
- `priorityLane` por defecto: **P4** si `dueDate` es nula (regla dura).
- `status` por defecto: **backlog**.
- `tags`: `[]`.
- `lastTouchedAt`: `createdAt`.

### 2.2 Enums
- `PriorityLane = P0 | P1 | P2 | P3 | P4`
- `Status = backlog | in_progress | blocked | done | archived`

### 2.3 Campos requeridos para riesgo
- `dueDate`, `effort`, `blockedSince`, `lastTouchedAt`, `createdAt`, `updatedAt`, `priorityLane`, `status`, `scheduledDate`.

### 2.4 Índices/keys para offline
- `id` como PK estable.
- `revision` + `updatedAt` para conflictos.
- `isDeleted` o `deletedAt` como tombstone.
- `schemaVersion` en meta global para migraciones.

> **Suposición mínima**: se mantiene `localforage` como persistencia (IndexedDB). Si no existiera, se migra a IndexedDB nativo.
> **Verificación (≤5 min)**: revisar `src/sync/storage.ts` y `package.json`.

---

## 3) Especificación del “Risk Engine”

### 3.1 Fórmula de score (pseudocódigo)
```text
score = 0

if status in {done, archived}: return 0

# Vencimiento
if dueDate exists:
  daysToDue = daysBetween(now, dueDate)
  if daysToDue < 0: score += 60 + abs(daysToDue) * 5
  else if daysToDue <= 1: score += 40
  else if daysToDue <= 3: score += 25
  else if daysToDue <= 7: score += 15
  else if daysToDue <= 14: score += 8

# Bloqueo
if status == blocked:
  daysBlocked = daysBetween(blockedSince, now)
  score += 20 + min(daysBlocked * 3, 30)

# Estancamiento
daysStale = daysBetween(lastTouchedAt, now)
if daysStale >= 7: score += 10
if daysStale >= 14: score += 20
if daysStale >= 30: score += 35

# Esfuerzo
if effort exists:
  if effort >= 240: score += 10
  if effort >= 480: score += 20

# Sobrecarga de carril
if laneOverCapacity(priorityLane): score += 15
```

### 3.2 Reglas discretas (alertas)
- `overdue`: `dueDate < today`
- `dueSoon`: `dueDate <= today + 3`
- `blockedTooLong`: `blockedSince >= 3 días`
- `staleTooLong`: `lastTouchedAt >= 7 días`
- `laneOverCapacity`: `count(lane) > limit(lane)`

### 3.3 Output
- `riskScore: number`
- `riskBand: "low"|"med"|"high"|"critical"`
- `reasons: string[]` (mensajes justificativos)
- `recommendedAction?: string`

### 3.4 Ordenamiento dentro de carril
1) `riskBand` (Critical > High > Med > Low)
2) `riskScore` desc
3) `dueDate` asc (nulas al final)
4) `createdAt` asc

---

## 4) Corrección de UI / navegación (por tab)

### 4.1 Bandeja
**Ahora**: lista de tareas `inbox`.

**Debe ser**: tareas nuevas **sin clasificación** o `status=backlog` sin lane asignada. Acciones rápidas:
- Asignar `priorityLane` (P0..P4)
- Cambiar `status` (backlog/in_progress/blocked)
- Setear `dueDate` o `scheduledDate`
- “Enviar a P4” (Algún día)

### 4.2 Tablero (rediseño obligatorio)
**Opción A (recomendada)**: columnas = **Prioridad (P0..P4)**; estado se visualiza como **chips** y se filtra por estado.

**Justificación**: preserva independencia real de ejes y evita columnas mezcladas (“Bloqueado/Hecho”).

**Requerimientos del tablero**:
- Límites por carril (WIP) en header.
- Indicador de sobrecarga (% y color).
- Comportamiento al exceder:
  - P0/P1: hard block (no se mueve/crea sin excepción).
  - P2/P3: warning (permite).
  - P4: sin límite.

### 4.3 Enfoque
- Selección desde tablero.
- Mostrar: `riskBand`, `reasons`, `dueDate`, `blockedSince`, `effort`.
- CTA: “Registrar Focus hoy”, “Resolver riesgo principal”.
- Al bloquear: set `status=blocked` y `blockedSince`.

### 4.4 Revisión
- Métricas: vencidas, sobrecarga por carril, bloqueadas largas, estancadas, completadas.
- Acciones:
  - “Reevaluar P0 del día” → re-lanear según `dueDate` + `riskScore`.
  - “Mover backlog estancado a P4”.

### 4.5 Calendario Mes/Semana
- Mostrar tareas con `scheduledDate` y/o `dueDate`.
- Diferenciar: `scheduledDate` vs `dueDate` (deadline) con color de riesgo.
- Vencidas resaltadas.

### 4.6 Settings
- Checklist de sync: URL configurada, estado online/offline, última sync, ops pendientes.
- Diagnóstico: ver cola, ver errores de sync.
- Import/Export con validación y versión de schema.

---

## 5) Reglas de límites (WIP / capacidad por carril)

**Defaults propuestos**
- P0: 3
- P1: 7
- P2: 10
- P3: 15
- P4: sin límite (warning opcional)

**Hard block vs soft warning**
- P0/P1: hard block al intentar agregar/mover si `count > limit`.
- P2/P3: warning no bloqueante.

**Excepción**
- Si la tarea está `overdue` o `dueSoon`, puede “forzar visibilidad” en P0/P1 sin incrementar el límite (se muestra en sección “Críticas”).

---

## 6) Arquitectura offline-first + Sync

### 6.1 Source of Truth
- Google Sheets vía Apps Script Web App si `webAppUrl` está configurado.
- Fallback local (IndexedDB/localforage).

### 6.2 Storage local (IndexedDB)
**Tablas/keys**
- `tasks`
- `opsQueue`
- `meta` (schemaVersion, lastSync)
- `logs` (errores de sync)

### 6.3 OpsQueue (idempotencia)
- `opId`, `taskId`, `type`, `payload`, `timestamp`, `baseRevision`, `dedupeKey`, `retryCount`, `lastError`.
- `dedupeKey = taskId + type + revision`.

### 6.4 Política de conflictos
- **Last-write-wins** por `revision` + `updatedAt`.
- Si gana server: reemplazar local.
- Si gana local: re-enqueue upsert.

### 6.5 Endpoints esperados (Apps Script)
- `GET ?route=meta` → `{ ok, serverTime, schemaVersion, sheets }`
- `GET ?route=pull&since=ISO` → `{ ok, tasks, serverTime }` (alias de `tasks` actual)
- `POST ?route=push` → `{ ok, applied[], rejected[] }` (alias de `upsert` actual)
- `POST ?route=test` → echo simple

### 6.6 Export/Import
- JSON con `{ schemaVersion, tasks, focusSessions?, opsQueue? }`.
- Validación de schema y migraciones versionadas.

---

## 7) Plan de migración desde el modelo actual

### 7.1 Mapeo de columnas actuales
- “Bandeja” → `status=backlog`, `priorityLane` inferida (sin dueDate → P4).
- “Hoy” → `priorityLane=P0`.
- “Semana” → `priorityLane=P1`.
- “Algún día” → `priorityLane=P4`.
- “Bloqueado” → `status=blocked`, `priorityLane` conserva o default P2.
- “Hecho” → `status=done`.

### 7.2 Migración sin perder info
- `plannedAt` → `scheduledDate`.
- `dueAt` → `dueDate`.
- `blockedSince` = `updatedAt` si no existe.
- `lastTouchedAt` = `updatedAt` si no existe.

### 7.3 Backfill
- Si no hay `dueDate`: `priorityLane=P4`.
- `isDeleted` a partir de `deletedAt`.

---

## 8) Plan de trabajo por fases (estimación cualitativa)

### Fase 0 — Auditoría del repo (XS)
Comandos:
- `rg "TaskStatus|status" src`
- `rg "sync" src`
- `rg "localforage" src`
- `rg "Board" src/components`

### Fase 1 — Refactor dominio y store (M)
- Actualizar `types` con nuevos enums y campos.
- Ajustar `store` y `buildEmptyTask`.
- Nueva migración.

### Fase 2 — Tablero (M/L)
- Columnas por `priorityLane`.
- Chips de estado y filtros.
- Límites por carril (hard/soft).

### Fase 3 — Risk Engine + alertas (M)
- Crear motor de riesgo y tests.
- Banners, badges, y ordenamiento por riesgo.

### Fase 4 — Enfoque + Revisión + Calendarios (M)
- Mostrar riesgo y razones.
- Métricas de revisión alineadas.
- Calendarios con `scheduledDate`/`dueDate`.

### Fase 5 — Sync robusto + export/import + diagnóstico (M)
- Ajustar cola e idempotencia.
- Actualizar contrato Apps Script.
- Validación de schema.

### Fase 6 — QA, e2e, accesibilidad, performance (M)
- Unit tests, UI tests, offline/sync tests.

---

## 9) Pruebas (obligatorio)

**Unit tests (Risk Engine)**
- `overdue`
- `dueSoon`
- `blockedTooLong`
- `staleTooLong`
- `laneOverCapacity`

**Migraciones**
- Dataset viejo → nuevo (lane/status/riesgo).

**UI**
- Drag/drop entre carriles.
- Límites P0/P1.
- Filtros por estado.

**Offline/Sync**
- Cola, retries, dedupe.
- Conflictos y LWW.

---

## 10) Criterios de aceptación (checklist)
- [ ] Prioridad, estado y riesgo son independientes.
- [ ] P0/P1 límites funcionando (hard/soft según definición).
- [ ] Vencidas/dueSoon resaltadas con razón explícita.
- [ ] Bloqueadas demasiado tiempo alertan.
- [ ] Sin fecha caen a P4.
- [ ] Revisión diaria refleja sobrecarga/estancamiento con acciones.
- [ ] Enfoque muestra “qué estás arriesgando” (reasons + recommendedAction).

---

## 11) Riesgos técnicos + mitigación
- **Drag/drop y performance** → memoización/virtualización.
- **Conflictos de sync** → LWW + logs.
- **Migraciones** → versionado y fallback seguro.
- **Mobile usability** → tablero vertical + chips compactos.

---

## 12) Lista exacta de archivos a tocar (según repo real)

### Dominio / Store
- `src/store/types.ts`
  - Agregar `priorityLane`, nuevos enums, campos de riesgo.
- `src/store/store.tsx`
  - Ajustar reducers, `setStatus`, `buildEmptyTask`.
- `src/store/migrations/index.ts`
  - Migrar status → lane + status, backfill de campos.

### Risk Engine
- `src/risk/engine.ts` (nuevo)
  - Cálculo de score/band/reasons.
- `src/utils/date.ts`
  - Helpers de días (si faltan).

### UI
- `src/App.tsx`
  - Rediseño de tablero por carriles.
  - Ajustes en Bandeja/Review/Focus.
- `src/components/BoardColumn.tsx`
  - WIP + indicador sobrecarga.
- `src/components/TaskCard.tsx`
  - Chips de estado + badge de riesgo.
- `src/components/ReviewSummary.tsx`
  - Nuevas métricas y acciones.
- `src/components/FocusTimer.tsx`
  - Razones de riesgo y recomendación.
- `src/components/CalendarMonth.tsx`
  - Mostrar `scheduledDate`/`dueDate`.
- `src/components/CalendarWeek.tsx`
  - Mostrar `scheduledDate`/`dueDate`.

### Sync / Offline
- `src/sync/storage.ts`
  - Schema version + meta.
- `src/sync/queue.ts`
  - dedupeKey + retries.
- `src/sync/engine.ts`
  - Conflictos LWW + nuevos campos.
- `src/sync/importExport.ts`
  - Validación schema + migraciones.
- `src/services/api.ts`
  - Ajustar contratos `pull/push`.

### Backend Apps Script
- `apps-script/Code.gs`
  - Actualizar headers y mapping de Task.

### Docs
- `README.md`
  - Lógica de ejes y riesgo.
- `README_BACKEND.md`
  - Contratos nuevos del Web App.
