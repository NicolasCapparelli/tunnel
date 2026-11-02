import { invoke } from "@tauri-apps/api/core";

/** Native HTTPS avoids WebView transport and browser-session dependencies. */
export function singularityNativeFetch(command: "singularity_auth_request" | "singularity_sync_request"): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    if (request.signal.aborted) throw request.signal.reason;
    const result = await invoke<{ status: number; body: string }>(command, {
      url: request.url, method: request.method,
      body: request.method === "GET" || request.method === "HEAD" ? null : await request.text(),
      authorization: request.headers.get("authorization"),
      contentType: request.headers.get("content-type"),
    });
    if (request.signal.aborted) throw request.signal.reason;
    return new Response(result.status === 204 ? null : result.body, { status: result.status });
  };
}
