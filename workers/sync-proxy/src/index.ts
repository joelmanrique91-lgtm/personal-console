interface Env {
  APPS_SCRIPT_EXEC: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(status: number, payload: unknown): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS
  });
  return new Response(JSON.stringify(payload), { status, headers });
}

function buildTargetUrl(execUrl: string, route: "meta" | "diag" | "sync"): string {
  const url = new URL(execUrl);
  url.searchParams.set("route", route);
  return url.toString();
}

async function proxyJson(
  targetUrl: string,
  init: RequestInit,
  route: "meta" | "diag" | "sync"
): Promise<Response> {
  const upstream = await fetch(targetUrl, init);
  const raw = await upstream.text();
  const preview = raw.slice(0, 300);

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    const staleHint = raw.includes("setResponseCode is not a function")
      ? " Apps Script desactualizado: redeploy del código sin setResponseCode()."
      : "";
    return json(502, {
      ok: false,
      error: `Invalid upstream JSON response for route=${route}.${staleHint}`,
      upstreamStatus: upstream.status,
      upstreamBodyPreview: preview,
      targetUrl
    });
  }

  return json(upstream.status, parsed);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    if (!env.APPS_SCRIPT_EXEC) {
      return json(500, { ok: false, error: "Missing APPS_SCRIPT_EXEC" });
    }

    try {
      if (request.method === "GET" && requestUrl.pathname === "/api/meta") {
        return proxyJson(buildTargetUrl(env.APPS_SCRIPT_EXEC, "meta"), { method: "GET" }, "meta");
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/diag") {
        return proxyJson(buildTargetUrl(env.APPS_SCRIPT_EXEC, "diag"), { method: "GET" }, "diag");
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/sync") {
        const body = await request.text();
        return proxyJson(
          buildTargetUrl(env.APPS_SCRIPT_EXEC, "sync"),
          {
            method: "POST",
            headers: {
              "Content-Type":
                request.headers.get("Content-Type") ||
                "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body
          },
          "sync"
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upstream request failed";
      return json(502, { ok: false, error: message });
    }

    return json(404, { ok: false, error: "Route not found" });
  }
};
