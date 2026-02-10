import { useCallback, useEffect, useMemo, useState } from "react";
import { buildRouteUrl, postSync, resolveEffectiveSyncBase } from "../services/api";
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
  responseStatus?: number;
  responseOk?: boolean;
  lastRequestUrl?: string;
  lastResponseBodyPreview?: string;
}

export interface SyncRequestSummary {
  url: string;
  workspaceKey: string;
  opsCount: number;
  effectiveSyncBase: string;
}

export interface SyncResponseSummary {
  status?: number;
  ok: boolean;
  appliedOpsCount: number;
  tasksCount: number;
  serverTime?: string;
  error?: string;
  lastRequestUrl?: string;
  lastResponseBodyPreview?: string;
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
  let responseStatus: number | undefined;
  let responseOk: boolean | undefined;
  let lastRequestUrl: string | undefined;
  let lastResponseBodyPreview: string | undefined;
  let queue = await getOpsQueue();
  let cached = await getTasksCache();

  for (const batch of chunkOps(queue)) {
    if (batch.length === 0) continue;
    const syncResult = await postSync(settings.webAppUrl, {
      workspaceKey: settings.workspaceKey,
      clientId: syncState.clientId,
      since: syncState.lastServerTime,
      ops: batch
    });
    const response = syncResult.body;
    responseStatus = syncResult.status;
    responseOk = syncResult.ok;
    lastRequestUrl = syncResult.requestUrl;
    lastResponseBodyPreview = syncResult.responseBodyPreview;
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
    const syncResult = await postSync(settings.webAppUrl, {
      workspaceKey: settings.workspaceKey,
      clientId: syncState.clientId,
      since: syncState.lastServerTime,
      ops: []
    });
    const response = syncResult.body;
    responseStatus = syncResult.status;
    responseOk = syncResult.ok;
    lastRequestUrl = syncResult.requestUrl;
    lastResponseBodyPreview = syncResult.responseBodyPreview;
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
      statusMessage,
      responseStatus,
      responseOk,
      lastRequestUrl,
      lastResponseBodyPreview
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
    responseStatus,
    responseOk,
    lastRequestUrl,
    lastResponseBodyPreview,
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
    webAppUrl: string,
    workspace: string,
    ops: { type: string }[]
  ): SyncRequestSummary => {
    const effectiveSyncBase = resolveEffectiveSyncBase(webAppUrl);
    let url = "--";
    try {
      url = buildRouteUrl(webAppUrl, "sync");
    } catch {
      // no-op
    }
    return {
      url,
      workspaceKey: workspace,
      opsCount: ops.length,
      effectiveSyncBase
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
      const settings = await getSyncSettings();
      await queueFlush();
      const queue = await getOpsQueue();
      setLastSyncRequestSummary(
        summarizeRequest(
          settings.webAppUrl ?? "",
          settings.workspaceKey ?? "",
          queue
        )
      );
      const outcome = await runSyncNow(replaceTasks);
      setConflictsResolved(outcome.conflictsResolved);
      setPendingOps(outcome.pendingOps);
      setLastServerTime(outcome.lastServerTime);
      setLastSyncAt(new Date().toISOString());
      setLastStatus(outcome.statusMessage ?? "Sync completado.");
      setLastSyncResponseSummary({
        status: outcome.responseStatus,
        ok:
          typeof outcome.responseOk === "boolean"
            ? outcome.responseOk
            : outcome.appliedOps > 0 || outcome.sentOps === 0,
        appliedOpsCount: outcome.appliedOps,
        tasksCount: outcome.tasksPulled,
        serverTime: outcome.lastServerTime,
        error: outcome.sentOps > 0 && outcome.appliedOps === 0
          ? "SYNC_ZERO_APPLIED"
          : undefined,
        lastRequestUrl: outcome.lastRequestUrl,
        lastResponseBodyPreview: outcome.lastResponseBodyPreview
      });
      return outcome;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "SYNC_UNKNOWN_ERROR";
      setLastError(message);
      setLastStatus(message);
      setLastSyncResponseSummary({
        ok: false,
        status: undefined,
        appliedOpsCount: 0,
        tasksCount: 0,
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
