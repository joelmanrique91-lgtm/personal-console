import { Task } from "../store/types";

export interface TasksResponse {
  ok: boolean;
  tasks: Task[];
  serverTime: string;
}

export interface UpsertOpPayload {
  opId: string;
  type: "upsert" | "delete";
  taskId: string;
  task?: Task;
  baseRevision?: number;
  createdAt: string;
}

export interface UpsertResponse {
  ok: boolean;
  applied: string[];
  rejected: { opId: string; reason: string; serverTask?: Task }[];
  serverTime: string;
}

export interface MetaResponse {
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  sheets?: string[];
  serverTime: string;
}

export interface FetchStatus<T> {
  status: number;
  ok: boolean;
  body: T | string;
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

async function fetchWithStatus<T>(input: string, init?: RequestInit): Promise<FetchStatus<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: T | string = text;
    try {
      body = text ? (JSON.parse(text) as T) : text;
    } catch (error) {
      body = text;
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchTasksSince(baseUrl: string, since?: string): Promise<TasksResponse> {
  return fetchJson<TasksResponse>(buildUrl(baseUrl, "tasks", { since }));
}

export async function upsertTasks(
  baseUrl: string,
  payload: { ops: UpsertOpPayload[] }
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

export async function fetchMetaWithStatus(baseUrl: string): Promise<FetchStatus<MetaResponse>> {
  return fetchWithStatus<MetaResponse>(buildUrl(baseUrl, "meta"));
}

export async function postOpsWithStatus(
  baseUrl: string,
  payload: { ops: UpsertOpPayload[] }
): Promise<FetchStatus<UpsertResponse>> {
  return fetchWithStatus<UpsertResponse>(buildUrl(baseUrl, "upsert"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
