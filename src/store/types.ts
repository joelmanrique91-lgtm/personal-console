export type LegacyTaskStatus =
  | "inbox"
  | "today"
  | "week"
  | "someday"
  | "done"
  | "blocked";

export type PriorityLane = "P0" | "P1" | "P2" | "P3" | "P4";

export type Status = "backlog" | "in_progress" | "blocked" | "done" | "archived";

export type TaskStatus = Status;

export type RiskBand = "low" | "medium" | "high" | "critical";

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
  description?: string;
  status: Status;
  priorityLane: PriorityLane;
  priority: TaskPriority;
  stream: TaskStream;
  tags: string[];
  estimateMin?: number;
  effort?: number;
  plannedAt?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  lastTouchedAt: string;
  revision: number;
  deletedAt?: string;
  blockedReason?: string;
  blockedSince?: string;
  doneAt?: string;
  oldStatus?: LegacyTaskStatus;
  riskScore?: number;
  riskBand?: RiskBand;
  riskReasons?: string[];
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
