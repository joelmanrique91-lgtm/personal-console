import { Task } from "../store/types";
import { startOfDay, startOfWeek } from "../utils/date";

interface CalendarMonthProps {
  currentDate: Date;
  tasks: Task[];
  onDropTask: (date: Date, taskId: string) => void;
}

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function CalendarMonth({ currentDate, tasks, onDropTask }: CalendarMonthProps) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate() + 6);

  const taskMap = new Map<string, Task[]>();
  tasks.forEach((task) => {
    if (!task.plannedAt) {
      return;
    }
    const key = task.plannedAt.slice(0, 10);
    const list = taskMap.get(key) ?? [];
    list.push(task);
    taskMap.set(key, list);
  });

  const days: Date[] = [];
  for (
    let cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    days.push(cursor);
  }

  return (
    <div className="calendar">
      <div className="calendar__weekdays">
        {WEEK_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar__grid">
        {days.map((day) => {
          const dayKey = toKey(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const list = taskMap.get(dayKey) ?? [];
          return (
            <div
              key={dayKey}
              className={`calendar__cell${isCurrentMonth ? "" : " calendar__cell--dim"}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const taskId = event.dataTransfer.getData("text/task");
                if (taskId) {
                  onDropTask(startOfDay(day), taskId);
                }
              }}
            >
              <div className="calendar__date">{day.getDate()}</div>
              <div className="calendar__tasks">
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
    </div>
  );
}
