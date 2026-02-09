export type TaskStatus =
  | "inbox"
  | "today"
  | "week"
  | "someday"
  | "done"
  | "blocked";

export type TaskPriority = "low" | "med" | "high";

export type TaskStream =
  | "geologia"
  | "pistacho"
  | "casa"
  | "finanzas"
  | "salud"
  | "otro";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  stream: TaskStream;
  tags: string[];
  estimateMin?: number;
  plannedAt?: string;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deletedAt?: string;
  blockedNote?: string;
  doneAt?: string;
}

export interface FocusSession {
  id: string;
  taskId: string;
  minutes: number;
  startedAt: string;
}

export interface AppState {
  tasks: Task[];
  focusSessions: FocusSession[];
  activeTaskId?: string;
}
