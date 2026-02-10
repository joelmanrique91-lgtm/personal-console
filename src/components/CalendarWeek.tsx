import { Task } from "../store/types";
import { startOfDay, startOfWeek } from "../utils/date";

interface CalendarWeekProps {
  currentDate: Date;
  tasks: Task[];
  onDropTask: (date: Date, taskId: string) => void;
}

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CalendarWeek({ currentDate, tasks, onDropTask }: CalendarWeekProps) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, index) =>
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index)
  );

  const taskMap = new Map<string, Task[]>();
  tasks.forEach((task) => {
    if (!task.dueDate) {
      return;
    }
    const key = task.dueDate.slice(0, 10);
    const list = taskMap.get(key) ?? [];
    list.push(task);
    taskMap.set(key, list);
  });

  return (
    <div className="calendar-week">
      {days.map((day) => {
        const dayKey = toKey(day);
        const list = taskMap.get(dayKey) ?? [];
        return (
          <div
            key={dayKey}
            className="calendar-week__day"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const taskId = event.dataTransfer.getData("text/task");
              if (taskId) {
                onDropTask(startOfDay(day), taskId);
              }
            }}
          >
            <div className="calendar-week__header">
              <span>{day.toLocaleDateString("es-ES", { weekday: "long" })}</span>
              <span>{day.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
            </div>
            <div className="calendar-week__tasks">
              {list.length === 0 ? <p className="calendar-week__empty">Sin tareas</p> : null}
              {list.map((task) => (
                <div
                  key={task.id}
                  className="calendar__task"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/task", task.id);
                  }}
                >
                  {task.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
