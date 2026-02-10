import { WarningIcon } from "../ui/icons";

interface HelpHintProps {
  title: string;
  lines: string[];
}

export function HelpHint({ title, lines }: HelpHintProps) {
  return (
    <aside className="help-hint" role="note" aria-label={title}>
      <div className="help-hint__title"><WarningIcon width={18} height={18} /> <strong>{title}</strong></div>
      <ul>
        {lines.slice(0, 3).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </aside>
  );
}
