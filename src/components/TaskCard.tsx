import { Task, TaskStatus } from "../store/types";

const statusLabels: Record<TaskStatus, string> = {
  inbox: "Inbox",
  today: "Hoy",
  week: "Semana",
  someday: "Algún día",
  blocked: "Bloqueado",
  done: "Hecho"
};

interface TaskCardProps {
  task: Task;
  onMove: (status: TaskStatus) => void;
  onSelect?: () => void;
}

export function TaskCard({ task, onMove, onSelect }: TaskCardProps) {
  return (
    <div className="task-card" draggable={!!onSelect} onClick={onSelect}>
      <div className="task-card__header">
        <h4>{task.title}</h4>
        <span className={`pill pill--${task.priority}`}>{task.priority}</span>
      </div>
      <p className="task-card__meta">
        {task.stream}
        {task.estimateMin ? ` · ${task.estimateMin}m` : ""}
      </p>
      {task.notes ? <p className="task-card__notes">{task.notes}</p> : null}
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
            <button key={status} type="button" onClick={() => onMove(status as TaskStatus)}>
              {label}
            </button>
          ))}
      </div>
    </div>
  );
}
