import { useEffect, useState } from "react";
import { PriorityLane, Status, Task } from "../store/types";
import { BlockIcon, CheckIcon, FocusIcon } from "../ui/icons";
import { calendarDayDiff, dateInputToIso } from "../utils/date";

const statusLabels: Record<Status, string> = {
  backlog: "Backlog",
  in_progress: "En curso",
  blocked: "Bloqueada",
  done: "Hecha",
  archived: "Archivada"
};

const laneLabels: Record<PriorityLane, string> = { P0: "Hoy", P1: "Semana", P2: "Mes", P3: "60 días", P4: "Algún día" };
const riskLabels = { critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo" } as const;

interface TaskCardProps {
  task: Task;
  onSelect?: () => void;
  onSetStatus?: (status: Status) => void;
  onSetLane?: (lane: PriorityLane) => void;
  onSetDueDate?: (dueDate?: string) => void;
  onBlock?: () => void;
  onSetFocus?: () => void;
  onUpdateTitle?: (title: string) => void;
  compact?: boolean;
}

function getDueSemaforo(task: Task): "ok" | "warn" | "danger" | "none" {
  if (!task.dueDate) return "none";
  const days = calendarDayDiff(task.dueDate);
  if (days < 0) return "danger";
  if (days <= 3) return "warn";
  return "ok";
}

function dueLabel(task: Task): string {
  if (!task.dueDate) return "Sin fecha";
  const due = new Date(task.dueDate);
  const days = calendarDayDiff(task.dueDate);
  if (days < 0) return "Vencida";
  if (days <= 3) return `Vence en ${Math.max(days, 0)} día(s)`;
  return due.toLocaleDateString("es-ES");
}

export function TaskCard({ task, onSelect, onSetStatus, onSetLane, onSetDueDate, onBlock, onSetFocus, onUpdateTitle, compact }: TaskCardProps) {
  const isSelectable = Boolean(onSelect);
  const dueSemaforo = getDueSemaforo(task);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  useEffect(() => setDraftTitle(task.title), [task.title]);

  return (
    <article
      className={`task-card card${isSelectable ? " task-card--selectable" : ""}`}
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
        {isEditingTitle ? (
          <input
            value={draftTitle}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const next = draftTitle.trim();
                if (next && next !== task.title) onUpdateTitle?.(next);
                setIsEditingTitle(false);
              }
              if (event.key === "Escape") {
                setDraftTitle(task.title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
          />
        ) : (
          <h4
            title="Click para editar título"
            onClick={(event) => {
              if (!onUpdateTitle) return;
              event.stopPropagation();
              setIsEditingTitle(true);
            }}
          >
            {task.title}
          </h4>
        )}
        <span className={`badge badge--status-${task.status}`}>{statusLabels[task.status]}</span>
      </div>
      <p className="task-card__meta">{laneLabels[task.priorityLane]}</p>
      <div className="task-card__risk-row">
        <p className={`badge badge--risk-${task.riskBand ?? "low"}`}>Riesgo {riskLabels[task.riskBand ?? "low"]}</p>
        <span className={`task-card__due-chip task-card__due-chip--${dueSemaforo}`}>{dueLabel(task)}</span>
      </div>
      <p className="task-card__notes">{task.riskReasons?.[0] ?? "Sin alertas activas"}</p>
      {task.tags.length > 0 ? (
        <div className="task-card__tags">
          {task.tags.map((tag) => <span key={tag} className="badge">#{tag}</span>)}
        </div>
      ) : null}
      {!compact ? (
        <div className="task-card__actions" onClick={(event) => event.stopPropagation()}>
          {onSetStatus ? (
            <>
              <button type="button" className="icon-btn" aria-label="Marcar en curso" title="Marcar en curso" onClick={() => onSetStatus("in_progress")}><FocusIcon width={16} height={16} /><span className="task-action-label">En curso</span></button>
              <button type="button" className="icon-btn" aria-label="Bloquear" title="Bloquear" onClick={onBlock}><BlockIcon width={16} height={16} /><span className="task-action-label">Bloquear</span></button>
              <button type="button" className="icon-btn" aria-label="Marcar hecha" title="Marcar como hecha" onClick={() => onSetStatus("done")}><CheckIcon width={16} height={16} /><span className="task-action-label">Hecha</span></button>
              <button type="button" className="btn btn--ghost btn--sm" title="Archivar tarea" onClick={() => onSetStatus("archived")}>Archivar</button>
            </>
          ) : null}
          {onSetFocus ? <button type="button" className="btn btn--secondary btn--sm" title="Poner en foco" onClick={onSetFocus}><FocusIcon width={16} height={16} /> Foco</button> : null}
          {onSetLane ? (
            <select value={task.priorityLane} onChange={(event) => onSetLane(event.target.value as PriorityLane)} aria-label="Asignar carril">
              {Object.entries(laneLabels).map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}
            </select>
          ) : null}
          {onSetDueDate ? (
            <label className="sr-only" htmlFor={`due-${task.id}`}>Definir fecha</label>
          ) : null}
          {onSetDueDate ? <input id={`due-${task.id}`} type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(event) => onSetDueDate(event.target.value ? dateInputToIso(event.target.value) : undefined)} aria-label="Definir fecha" /> : null}
        </div>
      ) : null}
    </article>
  );
}
