import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTasksSince, upsertTasks } from "../services/api";
import { Task } from "../store/types";
import {
  getOpsQueue,
  getSyncSettings,
  getSyncState,
  getTasksCache,
  setSyncState,
  setTasksCache
} from "./storage";
import { chunkOps, dequeueOps, enqueueUpsert } from "./queue";

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;

export interface SyncOutcome {
  conflictsResolved: number;
  pendingOps: number;
  lastServerTime?: string;
}

function isRemoteNewer(local: Task, remote: Task): boolean {
  if (remote.revision !== local.revision) {
    return remote.revision > local.revision;
  }
  return remote.updatedAt > local.updatedAt;
}

export function mergeTasks(localTasks: Task[], incoming: Task[]): Task[] {
  const merged = new Map(localTasks.map((task) => [task.id, task]));
  incoming.forEach((remote) => {
    const local = merged.get(remote.id);
    if (!local || isRemoteNewer(local, remote)) {
      merged.set(remote.id, remote);
    }
  });
  return Array.from(merged.values());
}

async function ensureSyncState() {
  const existing = await getSyncState();
  if (existing) {
    return existing;
  }
  const next = { clientId: crypto.randomUUID(), lastServerTime: undefined };
  await setSyncState(next);
  return next;
}

function shouldServerWin(local: Task | undefined, server: Task): boolean {
  if (!local) {
    return true;
  }
  return isRemoteNewer(local, server);
}

export async function runSyncNow(
  replaceTasks: (tasks: Task[]) => void
): Promise<SyncOutcome> {
  const settings = await getSyncSettings();
  if (!settings.webAppUrl) {
    throw new Error("SYNC_URL_MISSING");
  }

  const syncState = await ensureSyncState();
  let conflictsResolved = 0;
  let queue = await getOpsQueue();
  let cached = await getTasksCache();

  if (queue.length > 0) {
    for (const batch of chunkOps(queue)) {
      const response = await upsertTasks(settings.webAppUrl, {
        ops: batch.map((op) => ({
          opId: op.opId,
          type: op.type,
          taskId: op.taskId,
          task: op.task,
          baseRevision: op.baseRevision,
          createdAt: op.createdAt
        }))
      });
      if (!response.ok) {
        throw new Error("SYNC_PUSH_FAILED");
      }

      if (response.applied.length > 0 || response.rejected.length > 0) {
        queue = await dequeueOps([
          ...response.applied,
          ...response.rejected.map((item) => item.opId)
        ]);
      }

      const rejectedWithServer = response.rejected.filter((item) => item.serverTask);
      if (rejectedWithServer.length > 0) {
        for (const item of rejectedWithServer) {
          const serverTask = item.serverTask as Task;
          const localTask = cached.find((task) => task.id === serverTask.id);
          if (shouldServerWin(localTask, serverTask)) {
            cached = mergeTasks(cached, [serverTask]);
          } else if (localTask) {
            const now = new Date().toISOString();
            const nextTask: Task = {
              ...localTask,
              updatedAt: now,
              revision: serverTask.revision + 1
            };
            queue = await enqueueUpsert(nextTask);
          }
          conflictsResolved += 1;
        }
        await setTasksCache(cached);
        replaceTasks(cached);
      }
    }
  }

  const delta = await fetchTasksSince(settings.webAppUrl, syncState.lastServerTime);
  if (!delta.ok) {
    throw new Error("SYNC_PULL_FAILED");
  }
  cached = mergeTasks(cached, delta.tasks);
  await setTasksCache(cached);
  replaceTasks(cached);
  await setSyncState({ ...syncState, lastServerTime: delta.serverTime });

  return {
    conflictsResolved,
    pendingOps: queue.length,
    lastServerTime: delta.serverTime
  };
}

export function useSyncEngine(replaceTasks: (tasks: Task[]) => void) {
  const [syncing, setSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [conflictsResolved, setConflictsResolved] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastServerTime, setLastServerTime] = useState<string | undefined>(undefined);

  const refreshPending = useCallback(async () => {
    const queue = await getOpsQueue();
    setPendingOps(queue.length);
  }, []);

  const refreshLastServerTime = useCallback(async () => {
    const syncState = await getSyncState();
    setLastServerTime(syncState?.lastServerTime);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const outcome = await runSyncNow(replaceTasks);
      setConflictsResolved(outcome.conflictsResolved);
      setPendingOps(outcome.pendingOps);
      setLastServerTime(outcome.lastServerTime);
      return outcome;
    } finally {
      setSyncing(false);
    }
  }, [replaceTasks]);

  useEffect(() => {
    void refreshPending();
    void refreshLastServerTime();
  }, [refreshLastServerTime, refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void (async () => {
        const settings = await getSyncSettings();
        if (settings.webAppUrl) {
          await syncNow();
        }
      })();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }
    const interval = window.setInterval(() => {
      if (!syncing) {
        void (async () => {
          const settings = await getSyncSettings();
          if (settings.webAppUrl) {
            await syncNow();
          }
        })();
      }
    }, AUTO_SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isOnline, syncNow, syncing]);

  const status = useMemo(
    () => ({ syncing, pendingOps, conflictsResolved, isOnline, lastServerTime }),
    [conflictsResolved, isOnline, lastServerTime, pendingOps, syncing]
  );

  return { ...status, syncNow, refreshPending };
}
