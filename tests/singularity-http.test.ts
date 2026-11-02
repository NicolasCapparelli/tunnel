import { afterEach, expect, it, vi } from "vitest";
import { CloudflareSyncBackend } from "@entanglement/cloudflare";
import { invoke } from "@tauri-apps/api/core";
import { singularityNativeFetch } from "../apps/desktop/src/singularity-http";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const endpoint = "https://singularity.example.workers.dev";

it("reads Entanglement head through native HTTP with the session bearer token", async () => {
  vi.mocked(invoke).mockResolvedValue({ status: 200, body: '{"data":null}' });
  const webFetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("WebView unavailable"));
  try {
    const backend = new CloudflareSyncBackend(endpoint, { accessToken: async () => "test-token" }, singularityNativeFetch("singularity_sync_request"));
    expect(await backend.head()).toBeNull();
    expect(invoke).toHaveBeenCalledWith("singularity_sync_request", {
      url: endpoint + "/v1/head", method: "GET", body: null,
      authorization: "Bearer test-token", contentType: null,
    });
    expect(webFetch).not.toHaveBeenCalled();
  } finally { webFetch.mockRestore(); }
});

it("preserves history queries, DELETE bodies and error statuses", async () => {
  vi.mocked(invoke).mockResolvedValue({ status: 403, body: '{"error":"expired"}' });
  const request = singularityNativeFetch("singularity_sync_request");
  const response = await request(endpoint + "/v1/commits?after=2&upTo=4&limit=200");
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "expired" });
  vi.mocked(invoke).mockResolvedValue({ status: 200, body: '{"data":null}' });
  const backend = new CloudflareSyncBackend(endpoint, { accessToken: async () => "test-token" }, request);
  await backend.deleteRestorePoints([{ revision: 3, kind: "manual" }]);
  expect(invoke).toHaveBeenLastCalledWith("singularity_sync_request", expect.objectContaining({
    method: "DELETE", body: '[{"revision":3,"kind":"manual"}]', contentType: "application/json",
  }));
});
