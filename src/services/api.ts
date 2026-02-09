import { Task } from "../store/types";

export interface TasksResponse {
  tasks: Task[];
  serverTime: string;
}

export interface UpsertOpPayload {
  opId: string;
  task: Task;
}

export interface UpsertResponse {
  accepted: string[];
  rejected: { opId: string; reason: string; task?: Task }[];
  serverTime: string;
}

export interface MetaResponse {
  ok: boolean;
  serverTime: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

function buildUrl(baseUrl: string, route: string, params?: Record<string, string | undefined>) {
  const url = new URL(baseUrl);
  url.searchParams.set("route", route);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url.toString();
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchTasksSince(baseUrl: string, since?: string): Promise<TasksResponse> {
  return fetchJson<TasksResponse>(buildUrl(baseUrl, "tasks", { since }));
}

export async function upsertTasks(
  baseUrl: string,
  payload: { clientId: string; ops: UpsertOpPayload[] }
): Promise<UpsertResponse> {
  return fetchJson<UpsertResponse>(buildUrl(baseUrl, "upsert"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchMeta(baseUrl: string): Promise<MetaResponse> {
  return fetchJson<MetaResponse>(buildUrl(baseUrl, "meta"));
}
