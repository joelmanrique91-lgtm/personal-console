import { TaskPriority, TaskStream } from "../store/types";

interface FiltersProps {
  stream: TaskStream | "all";
  priority: TaskPriority | "all";
  onStreamChange: (value: TaskStream | "all") => void;
  onPriorityChange: (value: TaskPriority | "all") => void;
}

const streams: Array<{ value: TaskStream | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "geologia", label: "Geología" },
  { value: "pistacho", label: "Pistacho" },
  { value: "casa", label: "Casa" },
  { value: "finanzas", label: "Finanzas" },
  { value: "salud", label: "Salud" },
  { value: "otro", label: "Otro" }
];

const priorities: Array<{ value: TaskPriority | "all"; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "low", label: "Baja" },
  { value: "med", label: "Media" },
  { value: "high", label: "Alta" }
];

export function Filters({ stream, priority, onStreamChange, onPriorityChange }: FiltersProps) {
  return (
    <div className="filters">
      <label>
        Área
        <select value={stream} onChange={(event) => onStreamChange(event.target.value as TaskStream | "all")}>
          {streams.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
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
          {priorities.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
