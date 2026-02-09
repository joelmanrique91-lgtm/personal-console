import localforage from "localforage";
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { AppState, FocusSession, Task, TaskStatus } from "./types";

const STORAGE_KEY = "personal-console-state";

const initialState: AppState = {
  tasks: [],
  focusSessions: [],
  activeTaskId: undefined
};

type Action =
  | { type: "load"; payload: AppState }
  | { type: "add-task"; payload: Task }
  | { type: "update-task"; payload: Task }
  | { type: "delete-task"; payload: string }
  | { type: "set-status"; payload: { id: string; status: TaskStatus } }
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
    case "delete-task":
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.payload) };
    case "set-status":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id
            ? {
                ...task,
                status: action.payload.status,
                doneAt:
                  action.payload.status === "done" ? new Date().toISOString() : task.doneAt
              }
            : task
        )
      };
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
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const stored = await localforage.getItem<AppState>(STORAGE_KEY);
      if (stored && !cancelled) {
        dispatch({ type: "load", payload: stored });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void localforage.setItem(STORAGE_KEY, state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

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
  return {
    id: crypto.randomUUID(),
    title: overrides.title ?? "",
    notes: overrides.notes,
    status: overrides.status ?? "inbox",
    priority: overrides.priority ?? "med",
    stream: overrides.stream ?? "otro",
    estimateMin: overrides.estimateMin,
    createdAt: now,
    dueDate: overrides.dueDate,
    doneAt: overrides.doneAt,
    blockedNote: overrides.blockedNote,
    tags: overrides.tags
  };
}
