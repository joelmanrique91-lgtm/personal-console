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

export interface SyncHttpResult {
  status: number;
  ok: boolean;
  body: SyncResponse;
  requestUrl: string;
  responseBodyPreview: string;
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
  requestUrl: string;
  responseBodyPreview: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

function isGoogleScriptUrl(baseUrl: string): boolean {
  return (
    baseUrl.includes("script.google.com") ||
    baseUrl.includes("googleusercontent.com")
  );
}

export function resolveEffectiveSyncBase(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "/api";
  if (isGoogleScriptUrl(trimmed)) return "/api";
  return trimmed;
}

function buildRouteUrl(baseUrl: string, route: string) {
  const effectiveBase = resolveEffectiveSyncBase(baseUrl);

  if (effectiveBase.startsWith("/")) {
    const normalizedBase = effectiveBase.replace(/\/+$/, "");
    return `${normalizedBase}/${route}`;
  }

  const parsed = new URL(effectiveBase, window.location.origin);
  const sameOrigin = parsed.origin === window.location.origin;
  if (sameOrigin) {
    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${normalizedPath}/${route}`;
  }

  parsed.searchParams.set("route", route);
  return parsed.toString();
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
    const preview = text.slice(0, 200);
    let body: T | string = text;
    try {
      body = text ? (JSON.parse(text) as T) : text;
    } catch {
      body = text;
    }
    return {
      status: response.status,
      ok: response.ok,
      body,
      requestUrl: input,
      responseBodyPreview: preview
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchMetaWithStatus(
  baseUrl: string
): Promise<FetchStatus<MetaResponse>> {
  return fetchWithStatus<MetaResponse>(buildRouteUrl(baseUrl, "meta"));
}

export async function fetchDiagWithStatus(
  baseUrl: string
): Promise<FetchStatus<DiagResponse>> {
  return fetchWithStatus<DiagResponse>(buildRouteUrl(baseUrl, "diag"));
}

export async function postSync(
  baseUrl: string,
  payload: SyncRequest
): Promise<SyncHttpResult> {
  const syncUrl = buildRouteUrl(baseUrl, "sync");
  const formBody = new URLSearchParams({
    payload: JSON.stringify(payload)
  }).toString();

  let response: Response;
  try {
    response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: formBody
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch";
    throw new Error(`SYNC_NETWORK_ERROR: ${message}`);
  }

  const text = await response.text();
  const preview = text.slice(0, 200);
  let body: SyncResponse | null = null;
  try {
    body = text ? (JSON.parse(text) as SyncResponse) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`SYNC_HTTP_${response.status}: ${text || "empty response"}`);
    }
    throw new Error(`SYNC_PARSE_ERROR_${response.status}: ${text || "empty response"}`);
  }

  if (!response.ok) {
    const backendError = body?.error ? ` ${body.error}` : "";
    throw new Error(`SYNC_HTTP_${response.status}:${backendError || ` ${text}`}`.trim());
  }
  if (!body) {
    throw new Error(`SYNC_EMPTY_RESPONSE_${response.status}`);
  }
  if (body.ok === false) {
    throw new Error(body.error || `SYNC_BACKEND_ERROR_${response.status}`);
  }
  if (body.error) {
    throw new Error(body.error);
  }

  return {
    status: response.status,
    ok: response.ok,
    body,
    requestUrl: syncUrl,
    responseBodyPreview: preview
  };
}
