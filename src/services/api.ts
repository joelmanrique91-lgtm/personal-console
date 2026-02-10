import { Task } from "../store/types";
import { QueueOp } from "../sync/storage";

export interface MetaResponse {
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  sheets?: string[];
  serverTime: string;
}

export interface DiagResponse {
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  tasksRowCount: number;
  opsRowCount: number;
  eventsRowCount: number;
  focusRowCount: number;
  serverTime: string;
  error?: string;
}

export interface SyncResponse {
  ok?: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  serverTime: string;
  appliedOps: string[];
  conflicts: { opId: string; reason: string; serverTask?: Task }[];
  tasks: Task[];
  error?: string;
}

export interface SyncRequest {
  workspaceKey: string;
  clientId: string;
  since?: string;
  ops: QueueOp[];
}

export interface FetchStatus<T> {
  status: number;
  ok: boolean;
  body: T | string;
}

const DEFAULT_TIMEOUT_MS = 15000;

function buildUrl(baseUrl: string, route: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("route", route);
  return url.toString();
}

async function fetchWithStatus<T>(
  input: string,
  init?: globalThis.RequestInit
): Promise<FetchStatus<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS
  );
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: T | string = text;
    try {
      body = text ? (JSON.parse(text) as T) : text;
    } catch {
      body = text;
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchMetaWithStatus(
  baseUrl: string
): Promise<FetchStatus<MetaResponse>> {
  return fetchWithStatus<MetaResponse>(buildUrl(baseUrl, "meta"));
}

export async function fetchDiagWithStatus(
  baseUrl: string
): Promise<FetchStatus<DiagResponse>> {
  return fetchWithStatus<DiagResponse>(buildUrl(baseUrl, "diag"));
}

export async function postSync(
  baseUrl: string,
  payload: SyncRequest
): Promise<SyncResponse> {
  const result = await fetchWithStatus<SyncResponse>(
    buildUrl(baseUrl, "sync"),
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }
  );
  if (!result.ok || typeof result.body === "string") {
    throw new Error(`SYNC_ERROR_${result.status}`);
  }
  if (result.body.ok === false) {
    throw new Error(result.body.error || "SYNC_BACKEND_ERROR");
  }
  if (result.body.error) {
    throw new Error(result.body.error);
  }
  return result.body;
}
