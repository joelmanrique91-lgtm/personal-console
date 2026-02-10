import { useEffect, useMemo, useState } from "react";
import { FocusSession, PriorityLane, Status, Task } from "../store/types";
import { formatMinutes } from "../utils/date";

interface FocusTimerProps {
  task?: Task;
  sessions: FocusSession[];
  onAddSession: (minutes: number) => void;
  onSuggest: () => void;
  onSetStatus: (status: Status) => void;
  onSetLane: (lane: PriorityLane) => void;
  onSetDueDate: (dueDate: string) => void;
  onBlock: (note: string) => void;
}

export function FocusTimer({
  task,
  sessions,
  onAddSession,
  onSuggest,
  onSetStatus,
  onSetLane,
  onSetDueDate,
  onBlock
}: FocusTimerProps) {
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [blockedNote, setBlockedNote] = useState("");

  useEffect(() => {
    if (!running) {
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const totalMinutes = useMemo(() => {
    return sessions.reduce((sum, session) => sum + session.minutes, 0);
  }, [sessions]);

  const handleStop = () => {
    setRunning(false);
    if (elapsedSeconds >= 60) {
      const minutes = Math.round(elapsedSeconds / 60);
      onAddSession(minutes);
    }
    setElapsedSeconds(0);
  };

  return (
    <div className="focus-card">
      <h3>Foco del día</h3>
      <p className="board-hint">Elegí 1 tarea para hacer hoy. La app te muestra por qué es riesgosa.</p>
      {!task ? (
        <>
          <p>No hay tarea seleccionada.</p>
          <button type="button" onClick={onSuggest}>
            Sugerir foco
          </button>
        </>
      ) : (
        <>
          <p className="focus-card__title">{task.title}</p>
          <p>
            Carril {task.priorityLane} · Estado {task.status} · Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-ES") : "Sin fecha"}
          </p>
          <p>
            Riesgo: {task.riskBand ?? "low"} {task.riskScore ? `(${task.riskScore})` : ""}
          </p>
          {task.riskReasons && task.riskReasons.length > 0 ? (
            <ul>
              {task.riskReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>Sin alertas activas.</p>
          )}
          <p>
            Esfuerzo: {task.effort ? `${task.effort}m` : "-"} · Tags: {task.tags.length > 0 ? task.tags.join(", ") : "-"}
          </p>
          <div className="task-card__actions">
            <button type="button" onClick={() => onSetStatus("in_progress")}>Marcar En curso</button>
            <button
              type="button"
              onClick={() => {
                const note = window.prompt("Motivo del bloqueo", blockedNote) ?? "";
                if (note.trim()) {
                  onBlock(note.trim());
                  setBlockedNote("");
                }
              }}
            >
              Bloquear
            </button>
            <button type="button" onClick={() => onSetStatus("done")}>Hecha</button>
            <select
              value={task.priorityLane}
              onChange={(event) => onSetLane(event.target.value as PriorityLane)}
            >
              <option value="P0">Mover carril: P0</option>
              <option value="P1">Mover carril: P1</option>
              <option value="P2">Mover carril: P2</option>
              <option value="P3">Mover carril: P3</option>
              <option value="P4">Mover carril: P4</option>
            </select>
            <input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              onChange={(event) => onSetDueDate(event.target.value)}
              aria-label="Cambiar fecha"
            />
          </div>
          <div className="focus-card__timer">
            <span aria-live="polite">{formatMinutes(Math.round(elapsedSeconds / 60))}</span>
            <div>
              <button type="button" onClick={() => setRunning(true)} disabled={running}>
                Iniciar
              </button>
              <button type="button" onClick={handleStop} disabled={!running}>
                Detener
              </button>
            </div>
          </div>
          <p className="focus-card__meta">Total hoy: {formatMinutes(totalMinutes)}</p>
        </>
      )}
    </div>
  );
}
