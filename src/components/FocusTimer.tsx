import { useEffect, useMemo, useState } from "react";
import { FocusSession, Task } from "../store/types";
import { formatMinutes } from "../utils/date";

interface FocusTimerProps {
  task?: Task;
  sessions: FocusSession[];
  onAddSession: (minutes: number) => void;
  onBlocked: (note: string) => void;
}

export function FocusTimer({ task, sessions, onAddSession, onBlocked }: FocusTimerProps) {
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
      <h3>Enfoque</h3>
      {task ? (
        <>
          <p className="focus-card__title">{task.title}</p>
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
          <div className="focus-card__blocked">
            <label className="sr-only" htmlFor="blocked-note">
              Motivo de bloqueo
            </label>
            <textarea
              id="blocked-note"
              placeholder="Nota obligatoria si está bloqueada"
              value={blockedNote}
              onChange={(event) => setBlockedNote(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (blockedNote.trim()) {
                  onBlocked(blockedNote.trim());
                  setBlockedNote("");
                }
              }}
            >
              Marcar como bloqueada
            </button>
          </div>
        </>
      ) : (
        <p>Selecciona una tarea en el tablero para enfocarte.</p>
      )}
    </div>
  );
}
