interface HelpHintProps {
  title: string;
  lines: string[];
}

export function HelpHint({ title, lines }: HelpHintProps) {
  return (
    <div className="help-hint" role="note" aria-label={title}>
      <strong>{title}</strong>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
