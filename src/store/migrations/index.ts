import localforage from "localforage";
import { endOfWeek, startOfDay, startOfWeek } from "../../utils/date";
import { AppState, Task } from "../types";

const LEGACY_STORAGE_KEY = "personal-console-state";
const MIGRATION_KEY = "personal-console-migrated";

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

const migrateTask = (task: Task): Task => {
  const { plannedAt, dueAt } = statusToPlannedAt(task.status);
  const createdAt = task.createdAt ?? new Date().toISOString();
  return {
    ...task,
    plannedAt: task.plannedAt ?? plannedAt,
    dueAt: task.dueAt ?? dueAt,
    updatedAt: task.updatedAt ?? createdAt,
    revision: task.revision ?? 1,
    deletedAt: task.deletedAt ?? undefined
  };
};

export async function runMigrations(): Promise<AppState | null> {
  const migrated = await localforage.getItem<boolean>(MIGRATION_KEY);
  if (migrated) {
    return null;
  }

  const legacy = await localforage.getItem<AppState>(LEGACY_STORAGE_KEY);
  if (!legacy) {
    await localforage.setItem(MIGRATION_KEY, true);
    return null;
  }

  const migratedTasks = legacy.tasks.map((task) => migrateTask(task));
  const migratedState: AppState = {
    ...legacy,
    tasks: migratedTasks
  };

  await localforage.setItem(MIGRATION_KEY, true);
  return migratedState;
}
