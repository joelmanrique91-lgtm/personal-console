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

export async function buildExportPayload(): Promise<SyncExportPayload> {
  const tasks = await getTasksCache();
  const focusSessions = await getFocusSessions();
  const opsQueue = await getOpsQueue();
  const syncState = (await getSyncState()) ?? { clientId: crypto.randomUUID() };
  await setSyncState(syncState);
  return { tasks, focusSessions, opsQueue, syncState };
}

export async function importSyncPayload(
  payload: Partial<SyncExportPayload>,
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
      type: "upsert" as const,
      task,
      createdAt: now
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
