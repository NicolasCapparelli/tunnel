import { afterEach, expect, it, vi } from "vitest";
import { beginCloudflareSignIn, completeCloudflareSignIn, getCloudflareAccessToken, signOutCloudflare, type OAuthRecord, type OAuthVault } from "../packages/shared/src/singularity-auth";

afterEach(() => vi.unstubAllGlobals());
const endpoint = "https://singularity.example.workers.dev";
function vault() {
  let record: OAuthRecord | null = { clientId: "client", accountId: "user", accessToken: "expired", refreshToken: "rotating", expiresAt: 0 };
  return {
    read: async () => record,
    write: async (value: OAuthRecord) => { record = value; },
    clear: async () => { record = null; },
  } satisfies OAuthVault;
}
const discovery = { authorization_endpoint: `${endpoint}/authorize`, token_endpoint: `${endpoint}/token`, registration_endpoint: `${endpoint}/register` };

it("coalesces simultaneous token refreshes so rotating tokens are used once", async () => {
  const store = vault();
  const request = vi.fn(async (url: string) => Response.json(url.includes(".well-known") ? discovery : { access_token: "fresh", refresh_token: "rotated", expires_in: 900 }));
  vi.stubGlobal("fetch", request);
  expect(await Promise.all(Array.from({ length: 8 }, () => getCloudflareAccessToken(endpoint, store)))).toEqual(Array(8).fill("fresh"));
  expect(request.mock.calls.filter(([url]) => url.endsWith("/token"))).toHaveLength(1);
  expect((await store.read())?.refreshToken).toBe("rotated");
});

it("preserves credentials offline and allows retry after the network recovers", async () => {
  const store = vault();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
  expect(await getCloudflareAccessToken(endpoint, store)).toBeNull();
  expect((await store.read())?.refreshToken).toBe("rotating");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes(".well-known") ? discovery : { access_token: "fresh", expires_in: 900 })));
  expect(await getCloudflareAccessToken(endpoint, store)).toBe("fresh");
});

it("does not restore credentials when sign-out overlaps an in-flight refresh", async () => {
  const store = vault();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/token")) { await gate; return Response.json({ access_token: "fresh", expires_in: 900 }); }
    return Response.json(discovery);
  }));
  const refresh = getCloudflareAccessToken(endpoint, store);
  const signout = signOutCloudflare(endpoint, store);
  release();
  await Promise.all([refresh, signout]);
  expect(await store.read()).toBeNull();
});


it("uses the vault transport for desktop discovery, registration, tokens, identity and revocation", async () => {
  const browserFetch = vi.fn().mockRejectedValue(new Error("WebView fetch must not be used"));
  vi.stubGlobal("fetch", browserFetch);
  let record: OAuthRecord | null = null;
  const requests: string[] = [];
  const store: OAuthVault = {
    read: async () => record,
    write: async (value) => { record = value; },
    clear: async () => { record = null; },
    fetch: async (input) => {
      const url = String(input); requests.push(url);
      if (url.includes(".well-known")) return Response.json({ ...discovery, revocation_endpoint: `${endpoint}/revoke` });
      if (url.endsWith("/register")) return Response.json({ client_id: "native-client" });
      if (url.endsWith("/token")) return Response.json({ access_token: "native-access", refresh_token: "native-refresh", expires_in: 900 });
      if (url.endsWith("/v1/account")) return Response.json({ data: { accountId: "owner", email: "owner@example.com" } });
      return new Response(null, { status: 200 });
    },
  };
  const authorization = new URL(await beginCloudflareSignIn(endpoint, store, (n) => new Uint8Array(n).fill(7)));
  const state = authorization.searchParams.get("state");
  expect(await completeCloudflareSignIn(endpoint, `tunnel://singularity-auth?code=test&state=${state}`, store)).toEqual({ accountId: "owner", email: "owner@example.com" });
  await store.write({ ...(await store.read())!, expiresAt: 0 });
  expect(await getCloudflareAccessToken(endpoint, store)).toBe("native-access");
  await signOutCloudflare(endpoint, store);
  expect(requests.filter((url) => url.endsWith("/token"))).toHaveLength(2);
  expect(requests).toContain(`${endpoint}/revoke`);
  expect(browserFetch).not.toHaveBeenCalled();
  expect(await store.read()).toBeNull();
});


it.each([
  { advertised: undefined, expected: null },
  { advertised: ["email", "offline_access", "unrelated"], expected: "email offline_access" },
])("requests only advertised scopes and replaces a stale registration: $expected", async ({ advertised, expected }) => {
  let saved: OAuthRecord | null = { clientId: "old-client" };
  const registrationBodies: Record<string, unknown>[] = [];
  const store: OAuthVault = {
    read: async () => saved,
    write: async value => { saved = value; },
    clear: async () => { saved = null; },
    fetch: async (input, init) => {
      if (String(input).includes(".well-known")) return Response.json({ ...discovery, scopes_supported: advertised });
      registrationBodies.push(JSON.parse(String(init?.body)));
      return Response.json({ client_id: "new-client" });
    },
  };
  const url = new URL(await beginCloudflareSignIn(endpoint, store, n => new Uint8Array(n).fill(7)));
  expect(url.searchParams.get("scope")).toBe(expected);
  expect(url.searchParams.get("client_id")).toBe("new-client");
  expect(url.searchParams.get("resource")).toBe(endpoint);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toHaveLength(43);
  expect(url.searchParams.has("code_verifier")).toBe(false);
  expect(registrationBodies).toHaveLength(1);
  expect(registrationBodies[0]).not.toHaveProperty("resource");
  if (expected) expect(registrationBodies[0]?.scope).toBe(expected);
  else expect(registrationBodies[0]).not.toHaveProperty("scope");
  await beginCloudflareSignIn(endpoint, store, n => new Uint8Array(n).fill(8));
  expect(registrationBodies).toHaveLength(1); // Valid registration is reused, pending proof rotates.
});
