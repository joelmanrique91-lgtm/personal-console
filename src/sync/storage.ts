import localforage from "localforage";
import { FocusSession, Task } from "../store/types";

export const TASKS_KEY = "tasks_cache";
export const OPS_QUEUE_KEY = "ops_queue";
export const SYNC_STATE_KEY = "sync_state";
export const FOCUS_SESSIONS_KEY = "focus_sessions";
export const SYNC_SETTINGS_KEY = "sync_settings";
export const CALENDAR_VIEW_KEY = "calendar.view";
export const FOCUS_TASK_KEY = "focus.taskId";
export const LANE_LIMITS_KEY = "board.laneLimits";
export const AUTH_KEY = "auth.session";

export interface SyncState {
  clientId: string;
  lastServerTime?: string;
  lastSyncAt?: string;
}

export interface SyncSettings {
  webAppUrl?: string;
}

export interface AuthSession {
  idToken: string;
  userId: string;
  email?: string;
  expiresAt?: string;
}

export type LaneLimits = Record<"P0" | "P1" | "P2" | "P3" | "P4", number>;

export type CalendarViewMode = "month" | "week";

export interface SyncExportPayload {
  tasks: Task[];
  focusSessions: FocusSession[];
  opsQueue: QueueOp[];
  syncState: SyncState;
}

export interface QueueOp {
  opId: string;
  taskId?: string;
  type: "upsertTask" | "deleteTask" | "appendFocus";
  task?: Task;
  session?: FocusSession;
  ts: string;
  baseRevision?: number;
}

export async function getTasksCache(): Promise<Task[]> {
  return (await localforage.getItem<Task[]>(TASKS_KEY)) ?? [];
}

export async function setTasksCache(tasks: Task[]): Promise<void> {
  await localforage.setItem(TASKS_KEY, tasks);
}

export async function getOpsQueue(): Promise<QueueOp[]> {
  return (await localforage.getItem<QueueOp[]>(OPS_QUEUE_KEY)) ?? [];
}

export async function setOpsQueue(queue: QueueOp[]): Promise<void> {
  await localforage.setItem(OPS_QUEUE_KEY, queue);
}

export async function getSyncState(): Promise<SyncState | null> {
  return (await localforage.getItem<SyncState>(SYNC_STATE_KEY)) ?? null;
}

export async function setSyncState(state: SyncState): Promise<void> {
  await localforage.setItem(SYNC_STATE_KEY, state);
}

export async function getFocusSessions(): Promise<FocusSession[]> {
  return (await localforage.getItem<FocusSession[]>(FOCUS_SESSIONS_KEY)) ?? [];
}

export async function setFocusSessions(focusSessions: FocusSession[]): Promise<void> {
  await localforage.setItem(FOCUS_SESSIONS_KEY, focusSessions);
}

export async function getSyncSettings(): Promise<SyncSettings> {
  return (await localforage.getItem<SyncSettings>(SYNC_SETTINGS_KEY)) ?? {};
}

export async function setSyncSettings(settings: SyncSettings): Promise<void> {
  await localforage.setItem(SYNC_SETTINGS_KEY, settings);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  return (await localforage.getItem<AuthSession>(AUTH_KEY)) ?? null;
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  await localforage.setItem(AUTH_KEY, session);
}

export async function clearAuthSession(): Promise<void> {
  await localforage.removeItem(AUTH_KEY);
}

export async function getCalendarViewMode(): Promise<CalendarViewMode | null> {
  return (await localforage.getItem<CalendarViewMode>(CALENDAR_VIEW_KEY)) ?? null;
}

export async function setCalendarViewMode(mode: CalendarViewMode): Promise<void> {
  await localforage.setItem(CALENDAR_VIEW_KEY, mode);
}

export async function getFocusTaskId(): Promise<string | null> {
  return (await localforage.getItem<string>(FOCUS_TASK_KEY)) ?? null;
}

export async function setFocusTaskId(taskId: string | null): Promise<void> {
  if (!taskId) {
    await localforage.removeItem(FOCUS_TASK_KEY);
    return;
  }
  await localforage.setItem(FOCUS_TASK_KEY, taskId);
}

export async function getLaneLimits(): Promise<LaneLimits | null> {
  return (await localforage.getItem<LaneLimits>(LANE_LIMITS_KEY)) ?? null;
}

export async function setLaneLimits(limits: LaneLimits): Promise<void> {
  await localforage.setItem(LANE_LIMITS_KEY, limits);
}
