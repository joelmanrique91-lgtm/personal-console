import { TaskPriority, TaskStream } from "../store/types";

interface FiltersProps {
  stream: TaskStream | "all";
  priority: TaskPriority | "all";
  onStreamChange: (value: TaskStream | "all") => void;
  onPriorityChange: (value: TaskPriority | "all") => void;
}

const streams: Array<TaskStream | "all"> = [
  "all",
  "geologia",
  "pistacho",
  "casa",
  "finanzas",
  "salud",
  "otro"
];

const priorities: Array<TaskPriority | "all"> = ["all", "low", "med", "high"];

export function Filters({ stream, priority, onStreamChange, onPriorityChange }: FiltersProps) {
  return (
    <div className="filters">
      <label>
        Stream
        <select value={stream} onChange={(event) => onStreamChange(event.target.value as TaskStream | "all")}>
          {streams.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prioridad
        <select
          value={priority}
          onChange={(event) => onPriorityChange(event.target.value as TaskPriority | "all")}
        >
          {priorities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
