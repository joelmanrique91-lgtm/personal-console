import { Task, TaskStatus } from "../store/types";

const statusLabels: Record<TaskStatus, string> = {
  inbox: "Bandeja",
  today: "Hoy",
  week: "Semana",
  someday: "Algún día",
  blocked: "Bloqueado",
  done: "Hecho"
};

const priorityLabels: Record<Task["priority"], string> = {
  high: "Alta",
  med: "Media",
  low: "Baja"
};

interface TaskCardProps {
  task: Task;
  onMove: (status: TaskStatus) => void;
  onSelect?: () => void;
}

export function TaskCard({ task, onMove, onSelect }: TaskCardProps) {
  const isSelectable = Boolean(onSelect);
  return (
    <div
      className={`task-card${isSelectable ? " task-card--selectable" : ""}`}
      draggable={isSelectable}
      onClick={onSelect}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!isSelectable) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="task-card__header">
        <h4>{task.title}</h4>
        <span className={`pill pill--${task.priority}`}>{priorityLabels[task.priority]}</span>
      </div>
      <p className="task-card__meta">
        {task.stream}
        {task.estimateMin ? ` · ${task.estimateMin}m` : ""}
      </p>
      {task.blockedNote ? <p className="task-card__notes">{task.blockedNote}</p> : null}
      {task.tags && task.tags.length > 0 ? (
        <div className="task-card__tags">
          {task.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}
      <div className="task-card__actions">
        {Object.entries(statusLabels)
          .filter(([status]) => status !== task.status)
          .map(([status, label]) => (
            <button
              key={status}
              type="button"
              onClick={() => onMove(status as TaskStatus)}
              aria-label={`Mover a ${label}`}
            >
              {label}
            </button>
          ))}
      </div>
    </div>
  );
}
