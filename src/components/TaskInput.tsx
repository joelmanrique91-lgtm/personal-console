import { useState } from "react";

interface TaskInputProps {
  onAdd: (value: string) => void;
}

export function TaskInput({ onAdd }: TaskInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim()) {
      return;
    }
    onAdd(value.trim());
    setValue("");
  };

  return (
    <div className="task-input">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Captura rápida: escribir y Enter"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleSubmit();
          }
        }}
      />
      <button type="button" onClick={handleSubmit}>
        Add
      </button>
    </div>
  );
}
