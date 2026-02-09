import { useEffect, useMemo, useState } from "react";
import { BoardColumn } from "./components/BoardColumn";
import { CalendarMonth } from "./components/CalendarMonth";
import { CalendarWeek } from "./components/CalendarWeek";
import { Filters } from "./components/Filters";
import { FocusTimer } from "./components/FocusTimer";
import { ReviewSummary } from "./components/ReviewSummary";
import { TaskCard } from "./components/TaskCard";
import { TaskInput } from "./components/TaskInput";
import { fetchMetaWithStatus, postOpsWithStatus } from "./services/api";
import { buildEmptyTask, useStore } from "./store/store";
import { Task, TaskPriority, TaskStatus, TaskStream } from "./store/types";
import { useSyncEngine } from "./sync/engine";
import { buildExportPayload, importSyncPayload } from "./sync/importExport";
import { getSyncSettings, setSyncSettings } from "./sync/storage";
import { endOfWeek, isSameDay, startOfWeek } from "./utils/date";
import { parseQuickInput } from "./utils/quickParser";
import "./styles/app.css";

const statuses: { status: TaskStatus; label: string }[] = [
  { status: "inbox", label: "Bandeja" },
  { status: "today", label: "Hoy" },
  { status: "week", label: "Semana" },
  { status: "someday", label: "Algún día" },
  { status: "blocked", label: "Bloqueado" },
  { status: "done", label: "Hecho" }
];
const statusLabels = Object.fromEntries(statuses.map(({ status, label }) => [status, label]));

type View =
  | "inbox"
  | "board"
  | "focus"
  | "review"
  | "calendar-month"
  | "calendar-week"
  | "settings";

export function App() {
  const { state, dispatch, actions } = useStore();
  const [view, setView] = useState<View>("inbox");
  const [streamFilter, setStreamFilter] = useState<TaskStream | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
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

  const { syncing, pendingOps, conflictsResolved, isOnline, lastServerTime, syncNow } =
    useSyncEngine(actions.replaceTasks);

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
    if (!statusMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setStatusMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSyncSettings();
      if (settings.webAppUrl) {
        setWebAppUrl(settings.webAppUrl);
      }
    };
    void loadSettings();
  }, []);

  useEffect(() => {
    if (conflictsResolved > 0) {
      setStatusMessage(`Conflictos resueltos automáticamente: ${conflictsResolved}.`);
    }
  }, [conflictsResolved]);

  const visibleTasks = useMemo(
    () => state.tasks.filter((task) => !task.deletedAt),
    [state.tasks]
  );

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((task) => {
      if (streamFilter !== "all" && task.stream !== streamFilter) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [visibleTasks, streamFilter, priorityFilter]);

  const inboxTasks = visibleTasks.filter((task) => task.status === "inbox");
  const todayCount = visibleTasks.filter((task) => task.status === "today").length;

  const focusTask = visibleTasks.find((task) => task.id === state.activeTaskId);

  const todaySessions = state.focusSessions.filter((session) =>
    isSameDay(session.startedAt)
  );
  const focusMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);

  const todayCompleted = visibleTasks.filter(
    (task) => task.status === "done" && task.doneAt && isSameDay(task.doneAt)
  );
  const todayPending = visibleTasks.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "blocked" &&
      task.createdAt &&
      isSameDay(task.createdAt)
  );
  const todayBlocked = visibleTasks.filter(
    (task) => task.status === "blocked" && task.createdAt && isSameDay(task.createdAt)
  );

  const addTask = (rawValue: string) => {
    const parsed = parseQuickInput(rawValue);
    if (!parsed.title) {
      return;
    }
    const task = buildEmptyTask({
      title: parsed.title,
      priority: parsed.priority ?? "med",
      stream: parsed.stream ?? "otro",
      estimateMin: parsed.estimateMin,
      tags: parsed.tags
    });
    actions.addTask(task);
  };

  const moveTask = (task: Task, status: TaskStatus) => {
    actions.setStatus(task.id, status);
  };

  const handleDrop = (status: TaskStatus, taskId: string) => {
    actions.setStatus(taskId, status);
  };

  const handleSelectFocus = (task: Task) => {
    dispatch({ type: "set-active", payload: task.id });
    setView("focus");
  };

  const handleAddSession = (minutes: number) => {
    if (!focusTask) {
      return;
    }
    actions.addSession({
      id: crypto.randomUUID(),
      taskId: focusTask.id,
      minutes,
      startedAt: new Date().toISOString()
    });
  };

  const handleBlocked = (note: string) => {
    if (!focusTask) {
      return;
    }
    actions.updateTask({
      ...focusTask,
      status: "blocked",
      blockedNote: note
    });
  };

  const handleExport = async () => {
    const payload = JSON.stringify(await buildExportPayload());
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `personal-console-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Exportación lista. Revisa tus descargas.");
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { tasks?: Task[]; focusSessions?: unknown[] };
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        setStatusMessage("El archivo no tiene tareas válidas.");
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
      setStatusMessage("Importación completada. Ops generadas para sincronizar.");
    } catch (error) {
      console.error("Import failed", error);
      setStatusMessage("No se pudo importar el archivo.");
    }
  };

  const paletteResults = visibleTasks.filter((task) =>
    task.title.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  const handleSaveUrl = async () => {
    await setSyncSettings({ webAppUrl });
    setStatusMessage("URL guardada.");
  };

  const handleTestConnection = async () => {
    if (!webAppUrl) {
      setConnectionStatus("Ingresa la URL del Web App.");
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
    } catch (error) {
      console.error("Connection test failed", error);
      setConnectionStatus("No se pudo conectar.");
    }
  };

  const handleSendTestTask = async () => {
    if (!webAppUrl) {
      setConnectionStatus("Ingresa la URL del Web App.");
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
      setStatusMessage("TEST task enviada. Revisa Google Sheets.");
    } catch (error) {
      console.error("Test task failed", error);
      setStatusMessage("No se pudo enviar la TEST task.");
    }
  };

  const handleSyncNow = async () => {
    try {
      await syncNow();
      setStatusMessage("Sincronización completada.");
    } catch (error) {
      console.error("Sync failed", error);
      setStatusMessage("No se pudo sincronizar.");
    }
  };

  const handlePlanTask = (date: Date, taskId: string) => {
    const task = visibleTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    const plannedAt = date.toISOString();
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const status = isSameDay(plannedAt)
      ? "today"
      : date >= weekStart && date <= weekEnd
        ? "week"
        : "someday";
    actions.updateTask({ ...task, plannedAt, status });
  };

  const metaJson = typeof metaBody === "object" && metaBody !== null ? (metaBody as any) : null;
  const metaUrl = metaJson && metaJson.spreadsheetUrl ? String(metaJson.spreadsheetUrl) : "";

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Personal Console</h1>
          <p>Bandeja · Hoy · Semana · Algún día · Enfoque · Revisión</p>
        </div>
        <div className="app-header__actions">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
          >
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
                if (file) {
                  void handleImport(file);
                }
              }}
            />
          </label>
        </div>
        <div className="app-header__status">
          <span className={isOnline ? "online" : "offline"}>
            {isOnline ? "Online" : "Offline"}
          </span>
          <span>{pendingOps} ops pendientes</span>
          {syncing ? <span>Syncing...</span> : null}
        </div>
        {statusMessage ? (
          <div className="status-banner" role="status" aria-live="polite">
            {statusMessage}
          </div>
        ) : null}
      </header>

      <nav className="app-nav">
        {(
          [
            { id: "inbox", label: "Bandeja" },
            { id: "board", label: "Tablero" },
            { id: "focus", label: "Enfoque" },
            { id: "review", label: "Revisión" },
            { id: "calendar-month", label: "Calendario Mes" },
            { id: "calendar-week", label: "Calendario Semana" },
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
          <TaskInput onAdd={addTask} />
          <div className="inbox-list">
            {inboxTasks.map((task) => (
              <TaskCard key={task.id} task={task} onMove={(status) => moveTask(task, status)} />
            ))}
          </div>
        </section>
      ) : null}

      {view === "board" ? (
        <section className="view">
          <div className="board-header">
            <Filters
              stream={streamFilter}
              priority={priorityFilter}
              onStreamChange={setStreamFilter}
              onPriorityChange={setPriorityFilter}
            />
            <p className="board-hint">Arrastra tarjetas entre columnas o usa los botones de movimiento.</p>
            {todayCount > 5 ? (
              <p className="warning">Hoy tiene más de 5 tareas. Reduce el foco.</p>
            ) : null}
          </div>
          <div className="board">
            {statuses.map(({ status, label }) => (
              <BoardColumn
                key={status}
                status={status}
                title={label}
                onDropTask={handleDrop}
              >
                {filteredTasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/task", task.id);
                      }}
                    >
                      <TaskCard
                        task={task}
                        onMove={(newStatus) => moveTask(task, newStatus)}
                        onSelect={() => handleSelectFocus(task)}
                      />
                    </div>
                  ))}
              </BoardColumn>
            ))}
          </div>
        </section>
      ) : null}

      {view === "focus" ? (
        <section className="view">
          <FocusTimer
            task={focusTask}
            sessions={todaySessions.filter((session) => session.taskId === focusTask?.id)}
            onAddSession={handleAddSession}
            onBlocked={handleBlocked}
          />
        </section>
      ) : null}

      {view === "review" ? (
        <section className="view">
          <ReviewSummary
            completed={todayCompleted}
            pending={todayPending}
            blocked={todayBlocked}
            focusMinutes={focusMinutes}
            onMovePendingToToday={() => {
              todayPending.forEach((task) => moveTask(task, "today"));
            }}
            onClearTrash={() => {
              visibleTasks
                .filter((task) => task.status === "inbox" && task.title.length < 3)
                .forEach((task) => actions.deleteTask(task.id));
            }}
          />
        </section>
      ) : null}

      {view === "calendar-month" ? (
        <section className="view">
          <div className="calendar-header">
            <h2>
              {calendarDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
            </h2>
            <div className="calendar-header__actions">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(
                    new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)
                  )
                }
              >
                Mes anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(
                    new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)
                  )
                }
              >
                Mes siguiente
              </button>
            </div>
          </div>
          <CalendarMonth
            currentDate={calendarDate}
            tasks={visibleTasks}
            onDropTask={handlePlanTask}
          />
        </section>
      ) : null}

      {view === "calendar-week" ? (
        <section className="view">
          <div className="calendar-header">
            <h2>
              Semana del{" "}
              {startOfWeek(calendarDate).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short"
              })}
            </h2>
            <div className="calendar-header__actions">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth(),
                      calendarDate.getDate() - 7
                    )
                  )
                }
              >
                Semana anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth(),
                      calendarDate.getDate() + 7
                    )
                  )
                }
              >
                Semana siguiente
              </button>
            </div>
          </div>
          <CalendarWeek
            currentDate={calendarDate}
            tasks={visibleTasks}
            onDropTask={handlePlanTask}
          />
        </section>
      ) : null}

      {view === "settings" ? (
        <section className="view">
          <div className="settings">
            <h2>Sincronización</h2>
            <div className="settings__status-grid">
              <div>
                <strong>Estado:</strong> {isOnline ? "Online" : "Offline"}
              </div>
              <div>
                <strong>Último sync:</strong> {lastServerTime ?? "--"}
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
            <div className="settings__actions">
              <button type="button" onClick={handleSaveUrl}>
                Guardar URL
              </button>
              <button type="button" onClick={handleTestConnection}>
                Test connection
              </button>
              <button type="button" onClick={handleSendTestTask}>
                Send TEST task
              </button>
              <button type="button" onClick={handleSyncNow} disabled={!isOnline || syncing}>
                Sync now
              </button>
            </div>
            {connectionStatus ? <p className="settings__status">{connectionStatus}</p> : null}
            <div className="settings__results">
              <div>
                <h3>Meta response</h3>
                <p>
                  <strong>URL:</strong> {webAppUrl ? `${webAppUrl}?route=meta` : "--"}
                </p>
                <p>
                  <strong>Status:</strong> {metaStatus ?? "--"}
                </p>
                {metaUrl ? (
                  <p>
                    <strong>Spreadsheet:</strong>{" "}
                    <a href={metaUrl} target="_blank" rel="noreferrer">
                      Abrir Spreadsheet
                    </a>
                  </p>
                ) : null}
                <pre>{metaBody ? JSON.stringify(metaBody, null, 2) : "--"}</pre>
              </div>
              <div>
                <h3>TEST task response</h3>
                <p>
                  <strong>URL:</strong> {webAppUrl ? `${webAppUrl}?route=upsert` : "--"}
                </p>
                <p>
                  <strong>Status:</strong> {testStatus ?? "--"}
                </p>
                <pre>{testBody ? JSON.stringify(testBody, null, 2) : "--"}</pre>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {paletteOpen ? (
        <div className="palette" onClick={() => setPaletteOpen(false)}>
          <div
            className="palette__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Buscar tareas"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="palette__header">
              <p>Buscar tareas</p>
              <button type="button" onClick={() => setPaletteOpen(false)}>
                Cerrar
              </button>
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
                      <span>{statusLabels[task.status]}</span>
                    </div>
                    <div className="palette__actions">
                      <button type="button" onClick={() => moveTask(task, "today")}>
                        Hoy
                      </button>
                      <button type="button" onClick={() => moveTask(task, "week")}>
                        Semana
                      </button>
                      <button type="button" onClick={() => moveTask(task, "done")}>
                        Hecho
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
