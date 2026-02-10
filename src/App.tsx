import { useEffect, useMemo, useState } from "react";
import { BoardColumn } from "./components/BoardColumn";
import { CalendarMode, CalendarView } from "./components/CalendarView";
import { FocusTimer } from "./components/FocusTimer";
import { HelpHint } from "./components/HelpHint";
import { ReviewSummary } from "./components/ReviewSummary";
import { TaskCard } from "./components/TaskCard";
import { TaskInput } from "./components/TaskInput";
import { fetchMetaWithStatus, postOpsWithStatus } from "./services/api";
import { buildEmptyTask, useStore } from "./store/store";
import { PriorityLane, Status, Task } from "./store/types";
import { useSyncEngine } from "./sync/engine";
import { buildExportPayload, importSyncPayload } from "./sync/importExport";
import { getSyncSettings, setSyncSettings } from "./sync/storage";
import { isSameDay } from "./utils/date";
import { parseQuickInput } from "./utils/quickParser";
import { computeRisk, enrichTaskRisk } from "./utils/risk";
import "./styles/app.css";

const lanes: Array<{ lane: PriorityLane; label: string; limit: number }> = [
  { lane: "P0", label: "P0 Hoy", limit: 5 },
  { lane: "P1", label: "P1 Semana", limit: 12 },
  { lane: "P2", label: "P2 Mes", limit: 20 },
  { lane: "P3", label: "P3 60 días", limit: 30 },
  { lane: "P4", label: "P4 Algún día", limit: 0 }
];

const statusOptions: Status[] = ["backlog", "in_progress", "blocked", "done", "archived"];

type View = "inbox" | "board" | "focus" | "review" | "calendar" | "settings";

function laneFromDate(dateIso?: string): PriorityLane {
  if (!dateIso) return "P4";
  const now = new Date();
  const due = new Date(dateIso);
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "P0";
  if (days <= 7) return "P1";
  if (days <= 28) return "P2";
  if (days <= 60) return "P3";
  return "P4";
}

export function App() {
  const { state, dispatch, actions } = useStore();
  const [view, setView] = useState<View>("inbox");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [metaStatus, setMetaStatus] = useState<number | null>(null);
  const [metaBody, setMetaBody] = useState<unknown>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testBody, setTestBody] = useState<unknown>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(
    (window.localStorage.getItem("lastCalendarView") as CalendarMode) || "month"
  );
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [showGuide, setShowGuide] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const { syncing, pendingOps, conflictsResolved, isOnline, lastServerTime, syncNow } =
    useSyncEngine(actions.replaceTasks);

  useEffect(() => {
    window.localStorage.setItem("lastCalendarView", calendarMode);
  }, [calendarMode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    void (async () => {
      const settings = await getSyncSettings();
      if (settings.webAppUrl) setWebAppUrl(settings.webAppUrl);
    })();
  }, []);

  useEffect(() => {
    if (conflictsResolved > 0) {
      setStatusMessage(`Conflictos resueltos automáticamente: ${conflictsResolved}.`);
    }
  }, [conflictsResolved]);

  const visibleTasks = useMemo(() => state.tasks.filter((task) => !task.deletedAt), [state.tasks]);

  const tasksWithRisk = useMemo(() => visibleTasks.map((task) => enrichTaskRisk(task)), [visibleTasks]);

  const boardTasks = useMemo(() => {
    return tasksWithRisk
      .filter((task) => (statusFilter === "all" ? task.status !== "archived" : task.status === statusFilter))
      .filter((task) => task.status !== "done")
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
  }, [statusFilter, tasksWithRisk]);

  const inboxTasks = useMemo(() => {
    return tasksWithRisk.filter(
      (task) =>
        task.status === "backlog" &&
        (!task.dueDate || task.priorityLane === "P4")
    );
  }, [tasksWithRisk]);

  const focusTask = tasksWithRisk.find((task) => task.id === state.activeTaskId);
  const detailTask = tasksWithRisk.find((task) => task.id === detailTaskId);

  const todaySessions = state.focusSessions.filter((session) => isSameDay(session.startedAt));
  const focusMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);

  const todayCompleted = tasksWithRisk.filter(
    (task) => task.status === "done" && task.doneAt && isSameDay(task.doneAt)
  );
  const todayPending = tasksWithRisk.filter((task) => task.status === "in_progress");
  const todayBlocked = tasksWithRisk.filter((task) => task.status === "blocked");

  const addTask = (rawValue: string) => {
    const parsed = parseQuickInput(rawValue);
    if (!parsed.title) return;
    actions.addTask(
      buildEmptyTask({
        title: parsed.title,
        priority: parsed.priority ?? "med",
        stream: parsed.stream ?? "otro",
        estimateMin: parsed.estimateMin,
        effort: parsed.estimateMin,
        tags: parsed.tags,
        status: "backlog",
        priorityLane: "P4"
      })
    );
  };

  const handleDrop = (lane: PriorityLane, taskId: string) => {
    actions.setLane(taskId, lane);
  };

  const handleBlock = (task: Task) => {
    const reason = window.prompt("Motivo de bloqueo")?.trim();
    if (!reason) return;
    actions.setStatus(task.id, "blocked", reason);
  };

  const handleSuggestFocus = () => {
    const candidate = [...tasksWithRisk]
      .filter((task) => !["done", "archived"].includes(task.status))
      .sort((a, b) => {
        const laneWeight = ["P0", "P1"].includes(a.priorityLane)
          ? -1
          : ["P0", "P1"].includes(b.priorityLane)
            ? 1
            : 0;
        if (laneWeight !== 0) return laneWeight;
        return (b.riskScore ?? 0) - (a.riskScore ?? 0);
      })[0];
    if (!candidate) return;
    dispatch({ type: "set-active", payload: candidate.id });
    setStatusMessage(`Foco sugerido: ${candidate.title}`);
  };

  const handlePlanTask = (date: Date, taskId: string) => {
    const task = tasksWithRisk.find((item) => item.id === taskId);
    if (!task) return;
    const dueDate = date.toISOString();
    actions.updateTask({
      ...task,
      dueDate,
      priorityLane: laneFromDate(dueDate)
    });
  };

  const paletteResults = tasksWithRisk.filter((task) =>
    task.title.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  const handleExport = async () => {
    const payload = JSON.stringify(await buildExportPayload());
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `personal-console-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Exportación lista.");
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { tasks?: Task[]; focusSessions?: unknown[] };
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        setStatusMessage("Archivo inválido.");
        return;
      }
      await importSyncPayload(
        {
          tasks: parsed.tasks,
          focusSessions: Array.isArray(parsed.focusSessions)
            ? (parsed.focusSessions as typeof state.focusSessions)
            : []
        },
        actions.replaceTasks,
        actions.replaceFocusSessions
      );
      setStatusMessage("Importación completada.");
    } catch {
      setStatusMessage("No se pudo importar el archivo.");
    }
  };

  const handleSaveUrl = async () => {
    await setSyncSettings({ webAppUrl });
    setStatusMessage("URL guardada.");
  };

  const handleTestConnection = async () => {
    if (!webAppUrl) {
      setConnectionStatus("Para sincronizar, pegá la URL del Web App.");
      return;
    }
    setConnectionStatus("Probando conexión...");
    setMetaStatus(null);
    setMetaBody(null);
    try {
      const result = await fetchMetaWithStatus(webAppUrl);
      setMetaStatus(result.status);
      setMetaBody(result.body);
      setConnectionStatus(result.ok ? "Conexión OK." : "Conexión falló.");
    } catch {
      setConnectionStatus("No se pudo conectar.");
    }
  };

  const handleSendTestTask = async () => {
    if (!webAppUrl) {
      setConnectionStatus("Para sincronizar, pegá la URL del Web App.");
      return;
    }
    const now = new Date();
    const testTask = buildEmptyTask({ title: `TEST_SHEET_${now.getTime()}` });
    setTestStatus(null);
    setTestBody(null);
    try {
      const result = await postOpsWithStatus(webAppUrl, {
        ops: [
          {
            opId: crypto.randomUUID(),
            type: "upsert",
            taskId: testTask.id,
            task: testTask,
            createdAt: now.toISOString()
          }
        ]
      });
      setTestStatus(result.status);
      setTestBody(result.body);
      setStatusMessage("Tarea de prueba enviada.");
    } catch {
      setStatusMessage("No se pudo enviar la tarea de prueba.");
    }
  };

  const handleSyncNow = async () => {
    try {
      await syncNow();
      setStatusMessage("Sincronización completada.");
    } catch {
      setStatusMessage("No se pudo sincronizar.");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Personal Console</h1>
          <p>Tu Trello personal que piensa en tiempo, foco y riesgo.</p>
        </div>
        <div className="app-header__actions">
          <button type="button" onClick={() => setShowGuide(true)}>
            ? Cómo usar
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)}>
            Buscar (Ctrl+K)
          </button>
          <button type="button" onClick={() => void handleExport()}>
            Exportar
          </button>
          <label className="import-label">
            Importar
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
              }}
            />
          </label>
        </div>
        <div className="app-header__status">
          <span className={isOnline ? "online" : "offline"}>Estado: {isOnline ? "Online" : "Offline"}</span>
          <span>Ops pendientes: {pendingOps}</span>
          {syncing ? <span>Sincronizando…</span> : null}
        </div>
        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}
      </header>

      <nav className="app-nav">
        {(
          [
            { id: "inbox", label: "Entrada" },
            { id: "board", label: "Tablero" },
            { id: "focus", label: "Enfoque" },
            { id: "review", label: "Revisión" },
            { id: "calendar", label: "Calendario" },
            { id: "settings", label: "Settings" }
          ] as { id: View; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "active" : ""}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === "inbox" ? (
        <section className="view">
          <HelpHint
            title="Entrada / Captura"
            lines={[
              "Acá caen tareas nuevas.",
              "Tu trabajo es asignarles fecha o carril.",
              "Si no tienen fecha, van a P4."
            ]}
          />
          <TaskInput onAdd={addTask} />
          <div className="inbox-list">
            {inboxTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSetLane={(lane) => actions.setLane(task.id, lane)}
                onSetStatus={(status) => actions.setStatus(task.id, status)}
                onBlock={() => handleBlock(task)}
                onSelect={() => setDetailTaskId(task.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view === "board" ? (
        <section className="view">
          <HelpHint
            title="Tablero por carriles"
            lines={[
              "Las columnas son prioridad temporal (P0..P4).",
              "El estado vive dentro de cada tarjeta.",
              "Las tareas se ordenan por riesgo dentro de cada carril."
            ]}
          />
          <div className="board-header">
            <label>
              Filtrar por estado
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "all")}> 
                <option value="all">Todos (excepto hechas)</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="board">
            {lanes.map(({ lane, label, limit }) => {
              const laneTasks = boardTasks.filter((task) => task.priorityLane === lane);
              const countLabel = limit > 0 ? `${laneTasks.length}/${limit}` : `${laneTasks.length}/∞`;
              return (
                <BoardColumn key={lane} lane={lane} title={label} countLabel={countLabel} onDropTask={handleDrop}>
                  {laneTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/task", task.id);
                      }}
                    >
                      <TaskCard
                        task={task}
                        onSetStatus={(status) => actions.setStatus(task.id, status)}
                        onSetLane={(nextLane) => actions.setLane(task.id, nextLane)}
                        onBlock={() => handleBlock(task)}
                        onSelect={() => {
                          dispatch({ type: "set-active", payload: task.id });
                          setDetailTaskId(task.id);
                        }}
                      />
                    </div>
                  ))}
                </BoardColumn>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "focus" ? (
        <section className="view">
          <HelpHint
            title="Enfoque"
            lines={[
              "Elegí una sola tarea para hoy.",
              "Priorizá P0/P1 con mayor riesgo.",
              "Marcá bloqueos con motivo para no perder contexto."
            ]}
          />
          <FocusTimer
            task={focusTask}
            sessions={todaySessions.filter((session) => session.taskId === focusTask?.id)}
            onAddSession={(minutes) => {
              if (!focusTask) return;
              actions.addSession({
                id: crypto.randomUUID(),
                taskId: focusTask.id,
                minutes,
                startedAt: new Date().toISOString()
              });
            }}
            onSuggest={handleSuggestFocus}
            onSetStatus={(status) => {
              if (!focusTask) return;
              actions.setStatus(focusTask.id, status);
            }}
            onSetLane={(lane) => {
              if (!focusTask) return;
              actions.setLane(focusTask.id, lane);
            }}
            onSetDueDate={(date) => {
              if (!focusTask) return;
              const riskPreview = computeRisk({ ...focusTask, dueDate: date ? new Date(date).toISOString() : undefined });
              actions.updateTask({
                ...focusTask,
                dueDate: date ? new Date(date).toISOString() : undefined,
                priorityLane: date ? laneFromDate(new Date(date).toISOString()) : "P4",
                riskBand: riskPreview.band,
                riskScore: riskPreview.score,
                riskReasons: riskPreview.reasons
              });
            }}
            onBlock={(note) => {
              if (!focusTask) return;
              actions.setStatus(focusTask.id, "blocked", note);
            }}
          />
        </section>
      ) : null}

      {view === "review" ? (
        <section className="view">
          <HelpHint
            title="Revisión diaria"
            lines={[
              "Chequeá cuántas tareas cerraste hoy.",
              "Detectá bloqueos y pendientes críticos.",
              "Replanificá antes de cerrar el día."
            ]}
          />
          <ReviewSummary
            completed={todayCompleted}
            pending={todayPending}
            blocked={todayBlocked}
            focusMinutes={focusMinutes}
            onMovePendingToToday={() => {
              todayPending.forEach((task) => actions.setLane(task.id, "P0"));
            }}
            onClearTrash={() => {
              tasksWithRisk
                .filter((task) => task.status === "backlog" && task.title.length < 3)
                .forEach((task) => actions.deleteTask(task.id));
            }}
          />
        </section>
      ) : null}

      {view === "calendar" ? (
        <section className="view">
          <HelpHint
            title="Calendario"
            lines={[
              "Una sola pestaña con vista Mes/Semana.",
              "Mostramos tareas con fecha de vencimiento.",
              "Arrastrá tareas para cambiar su fecha."
            ]}
          />
          <CalendarView
            currentDate={calendarDate}
            tasks={tasksWithRisk.filter((task) => Boolean(task.dueDate))}
            mode={calendarMode}
            onModeChange={setCalendarMode}
            onChangeDate={setCalendarDate}
            onDropTask={handlePlanTask}
          />
        </section>
      ) : null}

      {view === "settings" ? (
        <section className="view">
          <div className="settings">
            <h2>Sincronización</h2>
            <HelpHint
              title="¿Qué es esto?"
              lines={[
                "La URL del Web App conecta con tu Google Sheets para sincronizar entre dispositivos.",
                "Sin URL, la app funciona offline/local (este navegador).",
                "Probar conexión verifica que el endpoint responda.",
                "Sincronizar ahora fuerza enviar/traer cambios."
              ]}
            />
            <div className="settings__status-grid">
              <div>
                <strong>Estado:</strong> {isOnline ? "Online" : "Offline"}
              </div>
              <div>
                <strong>Último sync:</strong> {lastServerTime ?? "Nunca"}
              </div>
              <div>
                <strong>Ops pendientes:</strong> {pendingOps}
              </div>
            </div>
            <label>
              URL del Web App
              <input
                type="url"
                value={webAppUrl}
                placeholder="https://script.google.com/macros/s/.../exec"
                onChange={(event) => setWebAppUrl(event.target.value)}
              />
            </label>
            {!webAppUrl ? <p className="warning">Para sincronizar, pegá la URL del Web App.</p> : null}
            <div className="settings__actions">
              <button type="button" onClick={handleSaveUrl}>
                Guardar URL
              </button>
              <button type="button" onClick={handleTestConnection} disabled={!webAppUrl}>
                Probar conexión
              </button>
              <button type="button" onClick={handleSendTestTask} disabled={!webAppUrl}>
                Enviar tarea de prueba
              </button>
              <button type="button" onClick={handleSyncNow} disabled={!isOnline || syncing || !webAppUrl}>
                Sincronizar ahora
              </button>
            </div>
            {connectionStatus ? <p className="settings__status">{connectionStatus}</p> : null}
            <div className="settings__results">
              <div>
                <h3>Meta response</h3>
                <p><strong>Status:</strong> {metaStatus ?? "--"}</p>
                <pre>{metaBody ? JSON.stringify(metaBody, null, 2) : "--"}</pre>
              </div>
              <div>
                <h3>TEST task response</h3>
                <p><strong>Status:</strong> {testStatus ?? "--"}</p>
                <pre>{testBody ? JSON.stringify(testBody, null, 2) : "--"}</pre>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {detailTask ? (
        <div className="palette" onClick={() => setDetailTaskId(null)}>
          <div className="palette__panel" onClick={(event) => event.stopPropagation()}>
            <div className="palette__header">
              <p>Detalle de tarea</p>
              <button type="button" onClick={() => setDetailTaskId(null)}>
                Cerrar
              </button>
            </div>
            <label>
              Título
              <input
                value={detailTask.title}
                onChange={(event) => actions.updateTask({ ...detailTask, title: event.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={detailTask.description ?? ""}
                onChange={(event) => actions.updateTask({ ...detailTask, description: event.target.value })}
              />
            </label>
            <div className="task-card__actions">
              <button type="button" onClick={() => actions.setStatus(detailTask.id, "archived")}>Archivar</button>
              <button type="button" onClick={() => actions.deleteTask(detailTask.id)}>Borrar</button>
            </div>
          </div>
        </div>
      ) : null}

      {showGuide ? (
        <div className="palette" onClick={() => setShowGuide(false)}>
          <div className="palette__panel" onClick={(event) => event.stopPropagation()}>
            <div className="palette__header">
              <p>Cómo usar la app</p>
              <button type="button" onClick={() => setShowGuide(false)}>Cerrar</button>
            </div>
            <ol>
              <li>Capturá tareas en Entrada y asignales fecha/carril.</li>
              <li>Trabajá en Tablero P0..P4; estado y riesgo están en cada tarjeta.</li>
              <li>Usá Enfoque para elegir 1 tarea y ejecutar sin distracciones.</li>
            </ol>
          </div>
        </div>
      ) : null}

      {paletteOpen ? (
        <div className="palette" onClick={() => setPaletteOpen(false)}>
          <div className="palette__panel" onClick={(event) => event.stopPropagation()}>
            <div className="palette__header">
              <p>Buscar tareas</p>
              <button type="button" onClick={() => setPaletteOpen(false)}>Cerrar</button>
            </div>
            <input
              autoFocus
              placeholder="Buscar tareas..."
              value={paletteQuery}
              onChange={(event) => setPaletteQuery(event.target.value)}
            />
            <div className="palette__results">
              {paletteResults.length === 0 ? (
                <p className="palette__empty">No hay tareas que coincidan.</p>
              ) : (
                paletteResults.map((task) => (
                  <div key={task.id} className="palette__item">
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.priorityLane}</span>
                    </div>
                    <div className="palette__actions">
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: "set-active", payload: task.id });
                          setView("focus");
                          setPaletteOpen(false);
                        }}
                      >
                        Ir a enfoque
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
