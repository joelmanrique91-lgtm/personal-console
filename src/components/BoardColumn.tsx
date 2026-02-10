import { ReactNode } from "react";
import { PriorityLane } from "../store/types";

interface BoardColumnProps {
  title: string;
  lane: PriorityLane;
  countLabel: string;
  limitState?: "normal" | "at_limit" | "over_limit";
  onDropTask: (lane: PriorityLane, taskId: string) => void;
  children: ReactNode;
}

export function BoardColumn({ title, lane, countLabel, limitState = "normal", onDropTask, children }: BoardColumnProps) {
  return (
    <section
      className={`board-column board-column--${limitState}`}
      role="region"
      aria-label={`Carril ${title}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/task");
        if (taskId) {
          onDropTask(lane, taskId);
        }
      }}
    >
      <header className="board-column__header">
        <h3>{title}</h3>
        <div className="board-column__meta">
          <span>{countLabel}</span>
          {limitState === "at_limit" ? <small>Al límite</small> : null}
          {limitState === "over_limit" ? <small>Sobrecargado</small> : null}
        </div>
      </header>
      <div className="board-column__content">{children}</div>
    </section>
  );
}
