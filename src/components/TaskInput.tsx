import { useId, useState } from "react";

interface TaskInputProps {
  onAdd: (value: string) => void;
}

export function TaskInput({ onAdd }: TaskInputProps) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const helperId = useId();

  const handleSubmit = () => {
    if (!value.trim()) {
      return;
    }
    onAdd(value.trim());
    setValue("");
  };

  return (
    <div className="task-input">
      <label className="task-input__label" htmlFor={inputId}>
        Nueva tarea
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Captura rápida: escribir y pulsar Enter"
        aria-describedby={helperId}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleSubmit();
          }
        }}
      />
      <p id={helperId} className="task-input__helper">
        Atajos: <span className="pill pill--low">#tag</span> <span className="pill pill--med">@contexto</span>{" "}
        <span className="pill pill--high">30m</span>
      </p>
      <button type="button" onClick={handleSubmit}>
        Añadir
      </button>
    </div>
  );
}
