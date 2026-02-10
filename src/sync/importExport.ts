import { FocusSession, Task } from "../store/types";
import { compactQueue } from "./queue";
import {
  QueueOp,
  SyncExportPayload,
  getFocusSessions,
  getOpsQueue,
  getSyncState,
  getTasksCache,
  setFocusSessions,
  setOpsQueue,
  setSyncState,
  setTasksCache
} from "./storage";

export const EXPORT_SCHEMA_VERSION = 1;

export async function buildExportPayload(includeDoneArchived = true): Promise<SyncExportPayload & { schemaVersion: number }> {
  const allTasks = await getTasksCache();
  const tasks = includeDoneArchived
    ? allTasks
    : allTasks.filter((task) => !["done", "archived"].includes(task.status));
  const focusSessions = await getFocusSessions();
  const opsQueue = await getOpsQueue();
  const syncState = (await getSyncState()) ?? { clientId: crypto.randomUUID() };
  await setSyncState(syncState);
  return { schemaVersion: EXPORT_SCHEMA_VERSION, tasks, focusSessions, opsQueue, syncState };
}

export async function importSyncPayload(
  payload: Partial<SyncExportPayload> & { schemaVersion?: number },
  replaceTasks: (tasks: Task[]) => void,
  replaceFocusSessions: (sessions: FocusSession[]) => void
): Promise<QueueOp[]> {
  const tasks = payload.tasks ?? [];
  const focusSessions = payload.focusSessions ?? [];
  await setTasksCache(tasks);
  await setFocusSessions(focusSessions);

  const now = new Date().toISOString();
  const opsQueue = compactQueue(
    tasks.map((task) => ({
      opId: crypto.randomUUID(),
      taskId: task.id,
      type: "upsertTask" as const,
      task,
      ts: now
    }))
  );
  await setOpsQueue(opsQueue);

  const existing = await getSyncState();
  const nextState = {
    clientId: existing?.clientId ?? payload.syncState?.clientId ?? crypto.randomUUID(),
    lastServerTime: payload.syncState?.lastServerTime
  };
  await setSyncState(nextState);

  replaceTasks(tasks);
  replaceFocusSessions(focusSessions);

  return opsQueue;
}
