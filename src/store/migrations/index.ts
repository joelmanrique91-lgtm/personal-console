import localforage from "localforage";
import { endOfWeek, startOfDay, startOfWeek } from "../../utils/date";
import { Task, AppState, TaskPriority, TaskStatus, TaskStream } from "../types";
import { OPS_QUEUE_KEY, QueueOp, TASKS_KEY } from "../../sync/storage";

const LEGACY_STORAGE_KEY = "personal-console-state";
const MIGRATION_KEY = "personal-console-migrated";
const MIGRATION_V2_KEY = "personal-console-migrated-v2";

const statusToPlannedAt = (status: Task["status"]): { plannedAt?: string; dueAt?: string } => {
  const now = new Date();
  if (status === "today") {
    return { plannedAt: startOfDay(now).toISOString(), dueAt: endOfWeek(now).toISOString() };
  }
  if (status === "week") {
    return { plannedAt: startOfWeek(now).toISOString(), dueAt: endOfWeek(now).toISOString() };
  }
  return {};
};

const normalizeTask = (task: Partial<Task>): Task => {
  const now = new Date().toISOString();
  const createdAt = task.createdAt ?? now;
  const { plannedAt, dueAt } = statusToPlannedAt((task.status as TaskStatus) ?? "inbox");
  return {
    id: task.id ?? crypto.randomUUID(),
    title: task.title ?? "",
    status: (task.status as TaskStatus) ?? "inbox",
    priority: (task.priority as TaskPriority) ?? "med",
    stream: (task.stream as TaskStream) ?? "otro",
    tags: Array.isArray(task.tags) ? task.tags : [],
    estimateMin: task.estimateMin ?? undefined,
    plannedAt: task.plannedAt ?? plannedAt,
    dueAt: task.dueAt ?? dueAt,
    createdAt,
    updatedAt: task.updatedAt ?? createdAt,
    revision: typeof task.revision === "number" ? task.revision : 1,
    deletedAt: task.deletedAt ?? undefined,
    blockedNote: task.blockedNote ?? undefined,
    doneAt: task.doneAt ?? undefined
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

  return legacyState;
}
