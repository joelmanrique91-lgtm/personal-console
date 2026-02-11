export function isSameDay(dateIso: string, compare = new Date()): boolean {
  const date = new Date(dateIso);
  return (
    date.getFullYear() === compare.getFullYear() &&
    date.getMonth() === compare.getMonth() &&
    date.getDate() === compare.getDate()
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

export function startOfDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date = new Date()): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff));
}

export function endOfWeek(date = new Date()): Date {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

export function toIsoDate(date: Date): string {
  return date.toISOString();
}

export function dateInputToIso(dateInput: string): string {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0).toISOString();
}

export function calendarDayDiff(dateIso: string, compare = new Date()): number {
  const target = startOfDay(new Date(dateIso));
  const base = startOfDay(compare);
  return Math.ceil((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
}
