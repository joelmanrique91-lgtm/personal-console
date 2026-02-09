import { useCallback, useEffect, useState } from "react";
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
import { chunkOps, dequeueOps } from "./queue";

export interface SyncOutcome {
  conflicts: Task[];
  pendingOps: number;
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

export async function runSyncNow(
  replaceTasks: (tasks: Task[]) => void
): Promise<SyncOutcome> {
  const settings = await getSyncSettings();
  if (!settings.webAppUrl) {
    throw new Error("SYNC_URL_MISSING");
  }

  const syncState = await ensureSyncState();
  const conflicts: Task[] = [];
  let queue = await getOpsQueue();

  if (queue.length > 0) {
    for (const batch of chunkOps(queue)) {
      const response = await upsertTasks(settings.webAppUrl, {
        clientId: syncState.clientId,
        ops: batch.map((op) => ({ opId: op.opId, task: op.task }))
      });
      if (response.accepted.length > 0 || response.rejected.length > 0) {
        queue = await dequeueOps([
          ...response.accepted,
          ...response.rejected.map((item) => item.opId)
        ]);
      }
      const rejectedTasks = response.rejected
        .map((item) => item.task)
        .filter((task): task is Task => Boolean(task));
      if (rejectedTasks.length > 0) {
        conflicts.push(...rejectedTasks);
        const cached = await getTasksCache();
        const merged = mergeTasks(cached, rejectedTasks);
        await setTasksCache(merged);
        replaceTasks(merged);
      }
    }
  }

  const delta = await fetchTasksSince(settings.webAppUrl, syncState.lastServerTime);
  const cached = await getTasksCache();
  const merged = mergeTasks(cached, delta.tasks);
  await setTasksCache(merged);
  replaceTasks(merged);
  await setSyncState({ ...syncState, lastServerTime: delta.serverTime });

  return { conflicts, pendingOps: queue.length };
}

export function useSyncEngine(replaceTasks: (tasks: Task[]) => void) {
  const [syncing, setSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [conflicts, setConflicts] = useState<Task[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refreshPending = useCallback(async () => {
    const queue = await getOpsQueue();
    setPendingOps(queue.length);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const outcome = await runSyncNow(replaceTasks);
      setConflicts(outcome.conflicts);
      setPendingOps(outcome.pendingOps);
      return outcome;
    } finally {
      setSyncing(false);
    }
  }, [replaceTasks]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  return { syncing, pendingOps, conflicts, isOnline, syncNow, refreshPending };
}
