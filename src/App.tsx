import { useEffect, useMemo, useState } from "react";
import { BoardColumn } from "./components/BoardColumn";
import { Filters } from "./components/Filters";
import { FocusTimer } from "./components/FocusTimer";
import { ReviewSummary } from "./components/ReviewSummary";
import { TaskCard } from "./components/TaskCard";
import { TaskInput } from "./components/TaskInput";
import { buildEmptyTask, useStore } from "./store/store";
import { Task, TaskPriority, TaskStatus, TaskStream } from "./store/types";
import { isSameDay } from "./utils/date";
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

type View = "inbox" | "board" | "focus" | "review";

export function App() {
  const { state, dispatch } = useStore();
  const [view, setView] = useState<View>("inbox");
  const [streamFilter, setStreamFilter] = useState<TaskStream | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

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

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      if (streamFilter !== "all" && task.stream !== streamFilter) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [state.tasks, streamFilter, priorityFilter]);

  const inboxTasks = state.tasks.filter((task) => task.status === "inbox");
  const todayCount = state.tasks.filter((task) => task.status === "today").length;

  const focusTask = state.tasks.find((task) => task.id === state.activeTaskId);

  const todaySessions = state.focusSessions.filter((session) =>
    isSameDay(session.startedAt)
  );
  const focusMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);

  const todayCompleted = state.tasks.filter(
    (task) => task.status === "done" && task.doneAt && isSameDay(task.doneAt)
  );
  const todayPending = state.tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.status !== "blocked" &&
      task.createdAt &&
      isSameDay(task.createdAt)
  );
  const todayBlocked = state.tasks.filter(
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
    dispatch({ type: "add-task", payload: task });
  };

  const moveTask = (task: Task, status: TaskStatus) => {
    dispatch({ type: "set-status", payload: { id: task.id, status } });
  };

  const handleDrop = (status: TaskStatus, taskId: string) => {
    dispatch({ type: "set-status", payload: { id: taskId, status } });
  };

  const handleSelectFocus = (task: Task) => {
    dispatch({ type: "set-active", payload: task.id });
    setView("focus");
  };

  const handleAddSession = (minutes: number) => {
    if (!focusTask) {
      return;
    }
    dispatch({
      type: "add-session",
      payload: {
        id: crypto.randomUUID(),
        taskId: focusTask.id,
        minutes,
        startedAt: new Date().toISOString()
      }
    });
  };

  const handleBlocked = (note: string) => {
    if (!focusTask) {
      return;
    }
    dispatch({
      type: "update-task",
      payload: {
        ...focusTask,
        status: "blocked",
        blockedNote: note
      }
    });
  };

  const handleExport = () => {
    const payload = JSON.stringify({
      tasks: state.tasks,
      focusSessions: state.focusSessions
    });
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
      dispatch({
        type: "bulk-import",
        payload: {
          tasks: parsed.tasks,
          focusSessions: Array.isArray(parsed.focusSessions)
            ? (parsed.focusSessions as typeof state.focusSessions)
            : [],
          activeTaskId: state.activeTaskId
        }
      });
      setStatusMessage("Importación completada.");
    } catch (error) {
      console.error("Import failed", error);
      setStatusMessage("No se pudo importar el archivo.");
    }
  };

  const paletteResults = state.tasks.filter((task) =>
    task.title.toLowerCase().includes(paletteQuery.toLowerCase())
  );

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
          <button type="button" onClick={handleExport}>
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
            { id: "review", label: "Revisión" }
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
              state.tasks
                .filter((task) => task.status === "inbox" && task.title.length < 3)
                .forEach((task) => dispatch({ type: "delete-task", payload: task.id }));
            }}
          />
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
