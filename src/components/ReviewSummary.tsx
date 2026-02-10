import { Task } from "../store/types";
import { formatMinutes } from "../utils/date";

interface ReviewAlert {
  id: string;
  label: string;
  count: number;
  tasks: Task[];
}

interface ReviewSummaryProps {
  completed: Task[];
  pending: Task[];
  blocked: Task[];
  focusMinutes: number;
  alerts: ReviewAlert[];
  onOpenTask: (taskId: string) => void;
  onMovePendingToToday: () => void;
  onClearTrash: () => void;
}

export function ReviewSummary({
  completed,
  pending,
  blocked,
  focusMinutes,
  alerts,
  onOpenTask,
  onMovePendingToToday,
  onClearTrash
}: ReviewSummaryProps) {
  const totalAlerts = alerts.reduce((sum, alert) => sum + alert.count, 0);

  return (
    <div className="review-summary">
      <h3>Review del día</h3>
      <div className="review-summary__grid">
        <div>
          <h4>Completadas</h4>
          <p>{completed.length}</p>
        </div>
        <div>
          <h4>Pendientes</h4>
          <p>{pending.length}</p>
        </div>
        <div>
          <h4>Bloqueadas</h4>
          <p>{blocked.length}</p>
        </div>
        <div>
          <h4>Focus hoy</h4>
          <p>{formatMinutes(focusMinutes)}</p>
        </div>
      </div>
      <div className="review-alerts">
        <h4>Alertas</h4>
        {totalAlerts === 0 ? (
          <p className="review-alerts__empty">Todo bajo control hoy ✅</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="review-alerts__group">
              <p>
                <strong>{alert.label}:</strong> {alert.count}
              </p>
              <ul>
                {alert.tasks.slice(0, 5).map((task) => (
                  <li key={task.id}>
                    <button type="button" onClick={() => onOpenTask(task.id)}>
                      {task.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      <div className="review-summary__actions">
        <button type="button" onClick={onMovePendingToToday}>
          Mover pendientes a Hoy mañana
        </button>
        <button type="button" onClick={onClearTrash}>
          Borrar tareas basura
        </button>
      </div>
    </div>
  );
}
