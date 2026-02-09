import localforage from "localforage";
import { FocusSession, Task } from "../store/types";

export const TASKS_KEY = "tasks_cache";
export const OPS_QUEUE_KEY = "ops_queue";
export const SYNC_STATE_KEY = "sync_state";
export const FOCUS_SESSIONS_KEY = "focus_sessions";
export const SYNC_SETTINGS_KEY = "sync_settings";

export interface SyncState {
  clientId: string;
  lastServerTime?: string;
}

export interface SyncSettings {
  webAppUrl?: string;
}

export interface SyncExportPayload {
  tasks: Task[];
  focusSessions: FocusSession[];
  opsQueue: QueueOp[];
  syncState: SyncState;
}

export interface QueueOp {
  opId: string;
  taskId: string;
  type: "upsert";
  task: Task;
  createdAt: string;
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
