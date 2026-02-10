import { Task } from "../store/types";
import { CalendarMonth } from "./CalendarMonth";
import { CalendarWeek } from "./CalendarWeek";

export type CalendarMode = "month" | "week";

interface CalendarViewProps {
  currentDate: Date;
  tasks: Task[];
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onChangeDate: (next: Date) => void;
  onDropTask: (date: Date, taskId: string) => void;
}

export function CalendarView({
  currentDate,
  tasks,
  mode,
  onModeChange,
  onChangeDate,
  onDropTask
}: CalendarViewProps) {
  return (
    <>
      <div className="calendar-header">
        <h2>
          {mode === "month"
            ? currentDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
            : `Semana del ${new Date(currentDate).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short"
              })}`}
        </h2>
        <div className="calendar-header__actions">
          <select value={mode} onChange={(event) => onModeChange(event.target.value as CalendarMode)}>
            <option value="month">Mes</option>
            <option value="week">Semana</option>
          </select>
          <button
            type="button"
            onClick={() =>
              onChangeDate(
                mode === "month"
                  ? new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
                  : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7)
              )
            }
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeDate(
                mode === "month"
                  ? new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                  : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7)
              )
            }
          >
            Siguiente
          </button>
        </div>
      </div>
      {mode === "month" ? (
        <CalendarMonth currentDate={currentDate} tasks={tasks} onDropTask={onDropTask} />
      ) : (
        <CalendarWeek currentDate={currentDate} tasks={tasks} onDropTask={onDropTask} />
      )}
    </>
  );
}
