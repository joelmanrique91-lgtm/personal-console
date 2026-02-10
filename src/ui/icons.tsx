import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) { return <IconBase {...props}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></IconBase>; }
export function CalendarIcon(props: IconProps) { return <IconBase {...props}><rect x="4" y="6" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></IconBase>; }
export function FocusIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" /></IconBase>; }
export function WarningIcon(props: IconProps) { return <IconBase {...props}><path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 9.5v4.2M12 16.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></IconBase>; }
export function CheckIcon(props: IconProps) { return <IconBase {...props}><path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
export function BlockIcon(props: IconProps) { return <IconBase {...props}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="m7 17 10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></IconBase>; }
export function SettingsIcon(props: IconProps) { return <IconBase {...props}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.8" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.8-1l-.4-2.5H9.7l-.4 2.5a7.6 7.6 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.8 1l.4 2.5h4.6l.4-2.5a7.6 7.6 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" stroke="currentColor" strokeWidth="1.2" /></IconBase>; }
export function SyncIcon(props: IconProps) { return <IconBase {...props}><path d="M18.5 8A7 7 0 0 0 6 7m-.5 9A7 7 0 0 0 18 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="m18.5 4.5.2 3.9-3.9.3M5.5 19.5l-.2-3.9 3.9-.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
