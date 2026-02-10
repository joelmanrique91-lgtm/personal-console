import localforage from "localforage";
import { endOfWeek, startOfDay, startOfWeek } from "../../utils/date";
import {
  AppState,
  LegacyTaskStatus,
  PriorityLane,
  Status,
  Task,
  TaskPriority,
  TaskStream
} from "../types";
import { OPS_QUEUE_KEY, QueueOp, TASKS_KEY } from "../../sync/storage";

const LEGACY_STORAGE_KEY = "personal-console-state";
const MIGRATION_KEY = "personal-console-migrated";
const MIGRATION_V2_KEY = "personal-console-migrated-v2";
const MIGRATION_V3_KEY = "personal-console-migrated-v3";

function laneFromDueDate(dueDate?: string): PriorityLane {
  if (!dueDate) {
    return "P4";
  }
  const now = new Date();
  const due = new Date(dueDate);
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "P0";
  if (days <= 7) return "P1";
  if (days <= 28) return "P2";
  if (days <= 60) return "P3";
  return "P4";
}

function mapLegacyStatus(status?: LegacyTaskStatus): { status: Status; priorityLane?: PriorityLane } {
  switch (status) {
    case "inbox":
      return { status: "backlog", priorityLane: "P4" };
    case "today":
      return { status: "backlog", priorityLane: "P0" };
    case "week":
      return { status: "backlog", priorityLane: "P1" };
    case "someday":
      return { status: "backlog", priorityLane: "P4" };
    case "blocked":
      return { status: "blocked" };
    case "done":
      return { status: "done" };
    default:
      return { status: "backlog" };
  }
}

const statusToPlannedAt = (status?: LegacyTaskStatus): { plannedAt?: string; dueDate?: string } => {
  const now = new Date();
  if (status === "today") {
    return { plannedAt: startOfDay(now).toISOString(), dueDate: endOfWeek(now).toISOString() };
  }
  if (status === "week") {
    return { plannedAt: startOfWeek(now).toISOString(), dueDate: endOfWeek(now).toISOString() };
  }
  return {};
};

const normalizeTask = (task: Partial<Task & { dueAt?: string; blockedNote?: string }>): Task => {
  const now = new Date().toISOString();
  const createdAt = task.createdAt ?? now;
  const oldStatus = task.oldStatus ?? (task as { status?: LegacyTaskStatus }).status;
  const mapped = mapLegacyStatus(oldStatus);
  const baseDue = task.dueDate ?? task.dueAt;
  const { plannedAt, dueDate } = statusToPlannedAt(oldStatus);
  const effectiveDueDate = baseDue ?? dueDate;
  const lane = task.priorityLane ?? mapped.priorityLane ?? laneFromDueDate(effectiveDueDate);

  return {
    id: task.id ?? crypto.randomUUID(),
    title: task.title ?? "",
    description: task.description,
    status: task.status ?? mapped.status,
    priorityLane: effectiveDueDate ? lane : "P4",
    priority: (task.priority as TaskPriority) ?? "med",
    stream: (task.stream as TaskStream) ?? "otro",
    tags: Array.isArray(task.tags) ? task.tags : [],
    estimateMin: task.estimateMin ?? undefined,
    effort: task.effort ?? task.estimateMin,
    plannedAt: task.plannedAt ?? plannedAt,
    dueDate: effectiveDueDate,
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    lastTouchedAt: task.lastTouchedAt ?? task.updatedAt ?? createdAt,
    revision: typeof task.revision === "number" ? task.revision : 1,
    deletedAt: task.deletedAt ?? undefined,
    blockedReason: task.blockedReason ?? task.blockedNote ?? undefined,
    blockedSince:
      (task.status ?? mapped.status) === "blocked"
        ? task.blockedSince ?? task.updatedAt ?? now
        : undefined,
    doneAt: task.doneAt ?? undefined,
    oldStatus,
    riskScore: task.riskScore,
    riskBand: task.riskBand,
    riskReasons: task.riskReasons
  };
};

const migrateTask = (task: Task): Task => normalizeTask(task);

export async function runMigrations(): Promise<AppState | null> {
  const migrated = await localforage.getItem<boolean>(MIGRATION_KEY);
  let legacyState: AppState | null = null;

  if (!migrated) {
    const legacy = await localforage.getItem<AppState>(LEGACY_STORAGE_KEY);
    if (!legacy) {
      await localforage.setItem(MIGRATION_KEY, true);
    } else {
      const migratedTasks = legacy.tasks.map((task) => migrateTask(task));
      legacyState = {
        ...legacy,
        tasks: migratedTasks
      };
      await localforage.setItem(MIGRATION_KEY, true);
    }
  }

  const migratedV2 = await localforage.getItem<boolean>(MIGRATION_V2_KEY);
  if (!migratedV2) {
    const cachedTasks = (await localforage.getItem<Task[]>(TASKS_KEY)) ?? [];
    const normalizedTasks = cachedTasks.map((task) => normalizeTask(task));
    await localforage.setItem(TASKS_KEY, normalizedTasks);

    const existingQueue = (await localforage.getItem<QueueOp[]>(OPS_QUEUE_KEY)) ?? [];
    if (existingQueue.length === 0 && normalizedTasks.length > 0) {
      const now = new Date().toISOString();
      const opsQueue: QueueOp[] = normalizedTasks.map((task) => ({
        opId: crypto.randomUUID(),
        taskId: task.id,
        type: "upsert",
        task,
        createdAt: now
      }));
      await localforage.setItem(OPS_QUEUE_KEY, opsQueue);
    }

    await localforage.setItem(MIGRATION_V2_KEY, true);
  }

  const migratedV3 = await localforage.getItem<boolean>(MIGRATION_V3_KEY);
  if (!migratedV3) {
    const cachedTasks = (await localforage.getItem<Task[]>(TASKS_KEY)) ?? [];
    const normalizedTasks = cachedTasks.map((task) => normalizeTask(task));
    await localforage.setItem(TASKS_KEY, normalizedTasks);
    await localforage.setItem(MIGRATION_V3_KEY, true);
  }

  return legacyState;
}
