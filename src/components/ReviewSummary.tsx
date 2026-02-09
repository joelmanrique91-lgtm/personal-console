import { Task } from "../store/types";
import { formatMinutes } from "../utils/date";

interface ReviewSummaryProps {
  completed: Task[];
  pending: Task[];
  blocked: Task[];
  focusMinutes: number;
  onMovePendingToToday: () => void;
  onClearTrash: () => void;
}

export function ReviewSummary({
  completed,
  pending,
  blocked,
  focusMinutes,
  onMovePendingToToday,
  onClearTrash
}: ReviewSummaryProps) {
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
      <div className="review-summary__actions">
        <button type="button" onClick={onMovePendingToToday}>
          Mover pendientes a Hoy (mañana)
        </button>
        <button type="button" onClick={onClearTrash}>
          Borrar tareas basura
        </button>
      </div>
    </div>
  );
}
