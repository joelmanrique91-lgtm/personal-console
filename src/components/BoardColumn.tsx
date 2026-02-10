import { ReactNode } from "react";
import { PriorityLane } from "../store/types";

interface BoardColumnProps {
  title: string;
  lane: PriorityLane;
  countLabel: string;
  onDropTask: (lane: PriorityLane, taskId: string) => void;
  children: ReactNode;
}

export function BoardColumn({ title, lane, countLabel, onDropTask, children }: BoardColumnProps) {
  return (
    <section
      className="board-column"
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
        <span>{countLabel}</span>
      </header>
      <div className="board-column__content">{children}</div>
    </section>
  );
}
