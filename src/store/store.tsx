import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { runMigrations } from "./migrations";
import { AppState, FocusSession, PriorityLane, Status, Task } from "./types";
import { enqueueDelete, enqueueFocusSession, enqueueUpsert } from "../sync/queue";
import { getFocusSessions, getTasksCache, setFocusSessions, setTasksCache } from "../sync/storage";
import { enrichTaskRisk } from "../utils/risk";

const initialState: AppState = {
  tasks: [],
  focusSessions: [],
  activeTaskId: undefined
};

type Action =
  | { type: "load"; payload: AppState }
  | { type: "add-task"; payload: Task }
  | { type: "update-task"; payload: Task }
  | { type: "replace-tasks"; payload: Task[] }
  | { type: "replace-focus"; payload: FocusSession[] }
  | { type: "set-active"; payload?: string }
  | { type: "add-session"; payload: FocusSession }
  | { type: "bulk-import"; payload: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return action.payload;
    case "add-task":
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case "update-task":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id ? action.payload : task
        )
      };
    case "replace-tasks":
      return { ...state, tasks: action.payload };
    case "replace-focus":
      return { ...state, focusSessions: action.payload };
    case "set-active":
      return { ...state, activeTaskId: action.payload };
    case "add-session":
      return { ...state, focusSessions: [action.payload, ...state.focusSessions] };
    case "bulk-import": {
      const existingTaskMap = new Map(state.tasks.map((task) => [task.id, task]));
      action.payload.tasks.forEach((task) => {
        existingTaskMap.set(task.id, task);
      });
      const existingSessionMap = new Map(
        state.focusSessions.map((session) => [session.id, session])
      );
      action.payload.focusSessions.forEach((session) => {
        existingSessionMap.set(session.id, session);
      });
      return {
        ...state,
        tasks: Array.from(existingTaskMap.values()),
        focusSessions: Array.from(existingSessionMap.values())
      };
    }
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  actions: {
    addTask: (task: Task) => void;
    updateTask: (task: Task) => void;
    setStatus: (taskId: string, status: Status, blockedReason?: string) => void;
    setLane: (taskId: string, lane: PriorityLane) => void;
    deleteTask: (taskId: string) => void;
    addSession: (session: FocusSession) => void;
    bulkImport: (state: AppState) => void;
    replaceTasks: (tasks: Task[]) => void;
    replaceFocusSessions: (sessions: FocusSession[]) => void;
  };
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const migrated = await runMigrations();
      const tasks = migrated?.tasks ?? (await getTasksCache());
      const focusSessions = migrated?.focusSessions ?? (await getFocusSessions());
      const normalizedTasks = tasks.map((task) => enrichTaskRisk(task));
      if (!cancelled) {
        dispatch({
          type: "load",
          payload: {
            tasks: normalizedTasks,
            focusSessions,
            activeTaskId: migrated?.activeTaskId
          }
        });
      }
      if (migrated) {
        await setTasksCache(normalizedTasks);
        await setFocusSessions(focusSessions);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void setTasksCache(state.tasks);
  }, [state.tasks]);

  useEffect(() => {
    void setFocusSessions(state.focusSessions);
  }, [state.focusSessions]);

  const actions = useMemo<StoreContextValue["actions"]>(() => {
    const addTask = (task: Task) => {
      const next = enrichTaskRisk(task);
      dispatch({ type: "add-task", payload: next });
      void enqueueUpsert(next);
    };

    const updateTask = (task: Task) => {
      const existing = state.tasks.find((item) => item.id === task.id);
      const now = new Date().toISOString();
      const nextTask: Task = enrichTaskRisk({
        ...task,
        tags: task.tags ?? [],
        dueDate: task.dueDate,
        updatedAt: now,
        lastTouchedAt: now,
        revision: existing ? existing.revision + 1 : task.revision
      });
      dispatch({ type: "update-task", payload: nextTask });
      void enqueueUpsert(nextTask);
    };

    const setStatus = (taskId: string, status: Status, blockedReason?: string) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const now = new Date().toISOString();
      const nextTask: Task = enrichTaskRisk({
        ...task,
        status,
        doneAt: status === "done" ? now : task.doneAt,
        blockedReason: status === "blocked" ? blockedReason ?? task.blockedReason : undefined,
        blockedSince: status === "blocked" ? task.blockedSince ?? now : undefined,
        updatedAt: now,
        lastTouchedAt: now,
        revision: task.revision + 1
      });
      dispatch({ type: "update-task", payload: nextTask });
      void enqueueUpsert(nextTask);
    };

    const setLane = (taskId: string, lane: PriorityLane) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const now = new Date().toISOString();
      const nextTask: Task = enrichTaskRisk({
        ...task,
        priorityLane: lane,
        updatedAt: now,
        lastTouchedAt: now,
        revision: task.revision + 1
      });
      dispatch({ type: "update-task", payload: nextTask });
      void enqueueUpsert(nextTask);
    };

    const deleteTask = (taskId: string) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const now = new Date().toISOString();
      const nextTask: Task = {
        ...task,
        deletedAt: now,
        updatedAt: now,
        lastTouchedAt: now,
        revision: task.revision + 1
      };
      dispatch({ type: "update-task", payload: nextTask });
      void enqueueDelete(nextTask);
    };

    const addSession = (session: FocusSession) => {
      dispatch({ type: "add-session", payload: session });
      void enqueueFocusSession(session);
    };
    const bulkImport = (payload: AppState) => {
      dispatch({ type: "bulk-import", payload });
    };
    const replaceTasks = (tasks: Task[]) => {
      dispatch({ type: "replace-tasks", payload: tasks.map((task) => enrichTaskRisk(task)) });
    };
    const replaceFocusSessions = (sessions: FocusSession[]) => {
      dispatch({ type: "replace-focus", payload: sessions });
    };

    return {
      addTask,
      updateTask,
      setStatus,
      setLane,
      deleteTask,
      addSession,
      bulkImport,
      replaceTasks,
      replaceFocusSessions
    };
  }, [state.tasks]);

  const value = useMemo(() => ({ state, dispatch, actions }), [state, dispatch, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
}

export function buildEmptyTask(overrides: Partial<Task>): Task {
  const now = new Date().toISOString();
  const dueDate = overrides.dueDate;
  return {
    id: crypto.randomUUID(),
    title: overrides.title ?? "",
    description: overrides.description,
    status: overrides.status ?? "backlog",
    priorityLane: overrides.priorityLane ?? (dueDate ? "P1" : "P4"),
    priority: overrides.priority ?? "med",
    stream: overrides.stream ?? "otro",
    tags: overrides.tags ?? [],
    estimateMin: overrides.estimateMin,
    effort: overrides.effort ?? overrides.estimateMin,
    plannedAt: overrides.plannedAt,
    dueDate,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    lastTouchedAt: overrides.lastTouchedAt ?? now,
    revision: overrides.revision ?? 1,
    deletedAt: overrides.deletedAt,
    doneAt: overrides.doneAt,
    blockedReason: overrides.blockedReason,
    blockedSince: overrides.blockedSince,
    oldStatus: overrides.oldStatus,
    riskScore: overrides.riskScore,
    riskBand: overrides.riskBand,
    riskReasons: overrides.riskReasons
  };
}
