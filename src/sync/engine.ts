import { useCallback, useEffect, useMemo, useState } from "react";
import { postSync } from "../services/api";
import { Task } from "../store/types";
import {
  getOpsQueue,
  getSyncSettings,
  getSyncState,
  getTasksCache,
  setSyncState,
  setTasksCache
} from "./storage";
import { chunkOps, dequeueOps, queueFlush } from "./queue";

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000;

export interface SyncOutcome {
  conflictsResolved: number;
  pendingOps: number;
  lastServerTime?: string;
  error?: string;
  sentOps: number;
  appliedOps: number;
  tasksPulled: number;
  statusMessage?: string;
}

export interface SyncRequestSummary {
  since?: string;
  opsCount: number;
  typesCount: Record<string, number>;
}

export interface SyncResponseSummary {
  ok: boolean;
  appliedOpsCount: number;
  conflictsCount: number;
  tasksPulledCount: number;
  serverTime?: string;
  error?: string;
}

function isRemoteNewer(local: Task, remote: Task): boolean {
  if (remote.updatedAt !== local.updatedAt)
    return remote.updatedAt > local.updatedAt;
  return remote.revision > local.revision;
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
  if (existing) return existing;
  const next = {
    clientId: crypto.randomUUID(),
    lastServerTime: undefined,
    lastSyncAt: undefined
  };
  await setSyncState(next);
  return next;
}

export async function runSyncNow(
  replaceTasks: (tasks: Task[]) => void
): Promise<SyncOutcome> {
  const settings = await getSyncSettings();
  if (!settings.webAppUrl) throw new Error("SYNC_URL_MISSING");
  if (!settings.workspaceKey) throw new Error("SYNC_WORKSPACE_MISSING");

  await queueFlush();
  const syncState = await ensureSyncState();
  let conflictsResolved = 0;
  let sentOps = 0;
  let appliedOps = 0;
  let tasksPulled = 0;
  let queue = await getOpsQueue();
  let cached = await getTasksCache();

  for (const batch of chunkOps(queue)) {
    if (batch.length === 0) continue;
    const response = await postSync(settings.webAppUrl, {
      workspaceKey: settings.workspaceKey,
      clientId: syncState.clientId,
      since: syncState.lastServerTime,
      ops: batch
    });
    sentOps += batch.length;
    appliedOps += response.appliedOps.length;
    tasksPulled += response.tasks.length;

    queue = await dequeueOps(response.appliedOps);

    conflictsResolved += response.conflicts.length;

    cached = mergeTasks(cached, response.tasks);
    await setTasksCache(cached);
    replaceTasks(cached);
    await setSyncState({
      ...syncState,
      lastServerTime: response.serverTime,
      lastSyncAt: new Date().toISOString()
    });
  }

  if (queue.length === 0) {
    const response = await postSync(settings.webAppUrl, {
      workspaceKey: settings.workspaceKey,
      clientId: syncState.clientId,
      since: syncState.lastServerTime,
      ops: []
    });
    tasksPulled += response.tasks.length;
    cached = mergeTasks(cached, response.tasks);
    await setTasksCache(cached);
    replaceTasks(cached);
    await setSyncState({
      ...syncState,
      lastServerTime: response.serverTime,
      lastSyncAt: new Date().toISOString()
    });
    const statusMessage =
      sentOps > 0 && appliedOps === 0
        ? "Sync sin cambios: 0 ops aplicadas. Revisá SpreadsheetId/Diag."
        : "Sync completado.";
    return {
      conflictsResolved,
      pendingOps: 0,
      lastServerTime: response.serverTime,
      sentOps,
      appliedOps,
      tasksPulled,
      statusMessage
    };
  }

  const stateNow = await getSyncState();
  return {
    conflictsResolved,
    pendingOps: queue.length,
    lastServerTime: stateNow?.lastServerTime,
    sentOps,
    appliedOps,
    tasksPulled,
    statusMessage:
      sentOps > 0 && appliedOps === 0
        ? "Sync sin cambios: 0 ops aplicadas. Revisá SpreadsheetId/Diag."
        : "Sync completado."
  };
}

export function useSyncEngine(replaceTasks: (tasks: Task[]) => void) {
  const [syncing, setSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [conflictsResolved, setConflictsResolved] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastServerTime, setLastServerTime] = useState<string | undefined>(
    undefined
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [lastSyncRequestSummary, setLastSyncRequestSummary] =
    useState<SyncRequestSummary | null>(null);
  const [lastSyncResponseSummary, setLastSyncResponseSummary] =
    useState<SyncResponseSummary | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const summarizeRequest = (
    since: string | undefined,
    ops: { type: string }[]
  ): SyncRequestSummary => {
    const typesCount: Record<string, number> = {};
    ops.forEach((op) => {
      typesCount[op.type] = (typesCount[op.type] ?? 0) + 1;
    });
    return {
      since,
      opsCount: ops.length,
      typesCount
    };
  };

  const canAutoSync = useCallback(async () => {
    const settings = await getSyncSettings();
    return Boolean(settings.webAppUrl && settings.workspaceKey);
  }, []);

  const refreshPending = useCallback(async () => {
    const queue = await getOpsQueue();
    setPendingOps(queue.length);
  }, []);

  const refreshSyncState = useCallback(async () => {
    const syncState = await getSyncState();
    setClientId(syncState?.clientId);
    setLastServerTime(syncState?.lastServerTime);
    setLastSyncAt(syncState?.lastSyncAt);
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setLastError(null);
    setLastStatus("Sincronizando...");
    try {
      const syncState = await ensureSyncState();
      await queueFlush();
      const queue = await getOpsQueue();
      setLastSyncRequestSummary(
        summarizeRequest(syncState.lastServerTime, queue)
      );
      const outcome = await runSyncNow(replaceTasks);
      setConflictsResolved(outcome.conflictsResolved);
      setPendingOps(outcome.pendingOps);
      setLastServerTime(outcome.lastServerTime);
      setLastSyncAt(new Date().toISOString());
      setLastStatus(outcome.statusMessage ?? "Sync completado.");
      setLastSyncResponseSummary({
        ok: outcome.appliedOps > 0 || outcome.sentOps === 0,
        appliedOpsCount: outcome.appliedOps,
        conflictsCount: outcome.conflictsResolved,
        tasksPulledCount: outcome.tasksPulled,
        serverTime: outcome.lastServerTime,
        error: outcome.sentOps > 0 && outcome.appliedOps === 0
          ? "SYNC_ZERO_APPLIED"
          : undefined
      });
      return outcome;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "SYNC_UNKNOWN_ERROR";
      setLastError(message);
      setLastStatus("Sync con error.");
      setLastSyncResponseSummary({
        ok: false,
        appliedOpsCount: 0,
        conflictsCount: 0,
        tasksPulledCount: 0,
        error: message
      });
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [replaceTasks]);

  useEffect(() => {
    void refreshPending();
    void refreshSyncState();
  }, [refreshSyncState, refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void (async () => {
        if (!(await canAutoSync())) return;
        const queue = await getOpsQueue();
        if (queue.length > 0) {
          try {
            await syncNow();
          } catch {
            // no-op, error surfaced in UI state
          }
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
  }, [canAutoSync, syncNow]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = window.setInterval(() => {
      if (!syncing) {
        void (async () => {
          if (!(await canAutoSync())) return;
          const queue = await getOpsQueue();
          if (queue.length > 0) {
            try {
              await syncNow();
            } catch {
              // no-op, error surfaced in UI state
            }
          }
        })();
      }
    }, AUTO_SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [canAutoSync, isOnline, syncNow, syncing]);

  const status = useMemo(
    () => ({
      syncing,
      pendingOps,
      conflictsResolved,
      isOnline,
      lastServerTime,
      lastSyncAt,
      lastError,
      clientId,
      lastSyncRequestSummary,
      lastSyncResponseSummary,
      lastStatus
    }),
    [
      conflictsResolved,
      isOnline,
      lastServerTime,
      pendingOps,
      syncing,
      lastSyncAt,
      lastError,
      clientId,
      lastSyncRequestSummary,
      lastSyncResponseSummary,
      lastStatus
    ]
  );

  return { ...status, syncNow, refreshPending, refreshSyncState };
}
