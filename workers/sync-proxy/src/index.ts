interface Env {
  APPS_SCRIPT_EXEC: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

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
        const upstream = await fetch(buildTargetUrl(env.APPS_SCRIPT_EXEC, "meta"), {
          method: "GET"
        });
        return withCors(upstream);
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/diag") {
        const upstream = await fetch(buildTargetUrl(env.APPS_SCRIPT_EXEC, "diag"), {
          method: "GET"
        });
        return withCors(upstream);
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/sync") {
        const body = await request.text();
        const upstream = await fetch(buildTargetUrl(env.APPS_SCRIPT_EXEC, "sync"), {
          method: "POST",
          headers: {
            "Content-Type": request.headers.get("Content-Type") || "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body
        });
        return withCors(upstream);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upstream request failed";
      return json(502, { ok: false, error: message });
    }

    return json(404, { ok: false, error: "Route not found" });
  }
};
