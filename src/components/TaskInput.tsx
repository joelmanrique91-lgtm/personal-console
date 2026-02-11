import { useId, useMemo, useState } from "react";
import { PlusIcon } from "../ui/icons";
import { parseQuickInput } from "../utils/quickParser";

interface TaskInputProps {
  onAdd: (value: string) => void;
}

export function TaskInput({ onAdd }: TaskInputProps) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const helperId = useId();

  const parsedPreview = useMemo(() => parseQuickInput(value), [value]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  };

  return (
    <section className="task-input card" aria-label="Crear tarea">
      <label className="task-input__label" htmlFor={inputId}>Nueva tarea</label>
      <div className="task-input__composer">
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Captura rápida: escribir y pulsar Enter"
          aria-describedby={helperId}
          onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
        />
        <button type="button" className="btn btn--primary btn--md" onClick={handleSubmit}>
          <PlusIcon width={16} height={16} /> Añadir
        </button>
      </div>
      <p id={helperId} className="task-input__helper">
        Atajos: <span className="badge">#tag</span> <span className="badge">@contexto</span> <span className="badge">30m / 2h</span>
      </p>
      {value.trim() ? (
        <div className="task-input__preview" aria-live="polite">
          {parsedPreview.tags.map((tag) => (
            <span key={tag} className="badge">#{tag}</span>
          ))}
          {parsedPreview.stream ? <span className="badge">@{parsedPreview.stream}</span> : null}
          {parsedPreview.estimateMin ? <span className="badge">{parsedPreview.estimateMin}m</span> : null}
        </div>
      ) : null}
    </section>
  );
}
