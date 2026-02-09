import { ReactNode } from "react";
import { TaskStatus } from "../store/types";

interface BoardColumnProps {
  title: string;
  status: TaskStatus;
  onDropTask: (status: TaskStatus, taskId: string) => void;
  children: ReactNode;
}

export function BoardColumn({ title, status, onDropTask, children }: BoardColumnProps) {
  return (
    <section
      className="board-column"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/task");
        if (taskId) {
          onDropTask(status, taskId);
        }
      }}
    >
      <header>
        <h3>{title}</h3>
      </header>
      <div className="board-column__content">{children}</div>
    </section>
  );
}
