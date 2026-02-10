import { PriorityLane, Status, Task } from "../store/types";

const statusLabels: Record<Status, string> = {
  backlog: "Backlog",
  in_progress: "En curso",
  blocked: "Bloqueada",
  done: "Hecha",
  archived: "Archivada"
};

const laneLabels: Record<PriorityLane, string> = {
  P0: "Hoy",
  P1: "Semana",
  P2: "Mes",
  P3: "60 días",
  P4: "Algún día"
};

const riskLabels = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo"
} as const;

interface TaskCardProps {
  task: Task;
  onSelect?: () => void;
  onSetStatus?: (status: Status) => void;
  onSetLane?: (lane: PriorityLane) => void;
  onSetDueDate?: (dueDate?: string) => void;
  onBlock?: () => void;
  onSetFocus?: () => void;
  compact?: boolean;
}

function getDueSemaforo(task: Task): "ok" | "warn" | "danger" | "none" {
  if (!task.dueDate) return "none";
  const due = new Date(task.dueDate);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "danger";
  if (days <= 3) return "warn";
  return "ok";
}

function dueLabel(task: Task): string {
  if (!task.dueDate) {
    return "Sin fecha";
  }
  const due = new Date(task.dueDate);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "Vencida";
  if (days <= 3) return `Vence en ${Math.max(days, 0)} día(s)`;
  return due.toLocaleDateString("es-ES");
}

export function TaskCard({
  task,
  onSelect,
  onSetStatus,
  onSetLane,
  onSetDueDate,
  onBlock,
  onSetFocus,
  compact
}: TaskCardProps) {
  const isSelectable = Boolean(onSelect);
  const dueSemaforo = getDueSemaforo(task);
  const topReason = task.riskReasons?.[0] ?? "Sin alertas activas";

  return (
    <article
      className={`task-card${isSelectable ? " task-card--selectable" : ""}`}
      onClick={onSelect}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isSelectable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="task-card__header">
        <h4>{task.title}</h4>
        <span className={`status-chip status-chip--${task.status}`}>{statusLabels[task.status]}</span>
      </div>
      <p className="task-card__meta">{laneLabels[task.priorityLane]}</p>
      <div className="task-card__risk-row">
        <p className={`risk-pill risk-pill--${task.riskBand ?? "low"}`}>
          Riesgo {riskLabels[task.riskBand ?? "low"]}
        </p>
        <span className={`task-card__due-chip task-card__due-chip--${dueSemaforo}`}>{dueLabel(task)}</span>
      </div>
      <p className="task-card__notes">{topReason}</p>
      {task.tags.length > 0 ? (
        <div className="task-card__tags">
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}
      {!compact ? (
        <div className="task-card__actions" onClick={(event) => event.stopPropagation()}>
          {onSetStatus ? (
            <>
              <button type="button" onClick={() => onSetStatus("in_progress")}>En curso</button>
              <button type="button" onClick={onBlock}>Bloquear</button>
              <button type="button" onClick={() => onSetStatus("done")}>Hecha</button>
              <button type="button" onClick={() => onSetStatus("archived")}>Archivar</button>
            </>
          ) : null}
          {onSetFocus ? (
            <button type="button" onClick={onSetFocus} title="Fijar como foco">
              🎯 Fijar foco
            </button>
          ) : null}
          {onSetLane ? (
            <select
              value={task.priorityLane}
              onChange={(event) => onSetLane(event.target.value as PriorityLane)}
              aria-label="Asignar carril"
            >
              {Object.entries(laneLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {value} · {label}
                </option>
              ))}
            </select>
          ) : null}
          {onSetDueDate ? (
            <input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              onChange={(event) =>
                onSetDueDate(event.target.value ? new Date(event.target.value).toISOString() : undefined)
              }
              aria-label="Definir fecha"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
