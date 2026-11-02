import { sha256 } from "@noble/hashes/sha2.js";

export interface OAuthRecord {
  clientId?: string;
  registrationProfile?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  email?: string;
  pending?: { state: string; verifier: string };
}
export interface OAuthVault {
  /** Native desktop transport avoids WebView Origin restrictions at the OAuth server. */
  fetch?: typeof fetch;
  read(): Promise<OAuthRecord | null>;
  write(value: OAuthRecord): Promise<void>;
  clear(): Promise<void>;
}
export interface OAuthMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
}
export interface AccountIdentity { accountId: string; email: string | null; }

function base64Url(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += alphabet[a >> 2];
    out += alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += alphabet[c & 63];
  }
  return out;
}

function apiEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Singularity requires an HTTPS Cloudflare Worker URL.");
  return url.toString().replace(/\/$/, "");
}

async function metadata(endpoint: string, vault: OAuthVault): Promise<OAuthMetadata> {
  const response = await (vault.fetch ?? fetch)(`${endpoint}/.well-known/oauth-authorization-server`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load Cloudflare Access OAuth settings. Check the Worker URL and Managed OAuth setup.");
  const value = await response.json() as Partial<OAuthMetadata>;
  for (const name of ["authorization_endpoint", "token_endpoint", "registration_endpoint"] as const) {
    if (typeof value[name] !== "string" || !value[name]!.startsWith("https://")) throw new Error("Cloudflare Access returned incomplete OAuth settings.");
  }
  return value as OAuthMetadata;
}

async function oauthError(response: Response): Promise<never> {
  let message = `Cloudflare sign-in failed (${response.status}).`;
  try {
    const value = await response.json() as { error_description?: string; error?: string };
    if (value.error_description) message = value.error_description;
    else if (value.error) message = value.error;
  } catch { /* Keep the status message. */ }
  throw new Error(message);
}

export async function beginCloudflareSignIn(
  apiUrl: string,
  vault: OAuthVault,
  randomBytes: (length: number) => Uint8Array,
): Promise<string> {
  const endpoint = apiEndpoint(apiUrl);
  let oauth: OAuthMetadata;
  oauth = await metadata(endpoint, vault);
  const record = await vault.read() ?? {};
  // Managed OAuth does not advertise OIDC scopes today. Do not invent scopes.
  const supportedScopes = Array.isArray(oauth.scopes_supported) ? oauth.scopes_supported : [];
  const scope = ["openid", "email", "offline_access"].filter(value => supportedScopes.includes(value)).join(" ");
  const registrationProfile = JSON.stringify({ version: 2, redirect: `${endpoint}/oauth/callback`, scope });
  let clientId = record.registrationProfile === registrationProfile ? record.clientId : undefined;
  if (!clientId) {
    const registration = await (vault.fetch ?? fetch)(oauth.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Tunnel Singularity",
        redirect_uris: [`${endpoint}/oauth/callback`],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        ...(scope ? { scope } : {}),
      }),
    });
    if (!registration.ok) return oauthError(registration);
    const registered = await registration.json() as { client_id?: string };
    if (!registered.client_id) throw new Error("Cloudflare did not return an OAuth client ID.");
    clientId = registered.client_id;
  }

  const state = base64Url(randomBytes(32));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(sha256(new TextEncoder().encode(verifier)));
  await vault.write({ ...record, clientId, registrationProfile, pending: { state, verifier } });
  const authorization = new URL(oauth.authorization_endpoint);
  authorization.searchParams.set("client_id", clientId);
  authorization.searchParams.set("redirect_uri", `${endpoint}/oauth/callback`);
  authorization.searchParams.set("response_type", "code");
  if (scope) authorization.searchParams.set("scope", scope);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("resource", endpoint);
  return authorization.toString();
}

export async function completeCloudflareSignIn(
  apiUrl: string,
  callbackUrl: string,
  vault: OAuthVault,
): Promise<AccountIdentity> {
  const endpoint = apiEndpoint(apiUrl);
  const callback = new URL(callbackUrl);
  if (callback.protocol !== "tunnel:" || callback.hostname !== "singularity-auth") throw new Error("This is not a Tunnel sign-in callback.");
  const record = await vault.read();
  const state = callback.searchParams.get("state");
  const code = callback.searchParams.get("code");
  const oauthFailure = callback.searchParams.get("error_description") ?? callback.searchParams.get("error");
  if (oauthFailure) throw new Error(oauthFailure);
  if (!record?.pending || !state || state !== record.pending.state || !code) {
    throw new Error("Sign-in could not be verified. Please start again.");
  }
  if (!record.clientId) throw new Error("Start sign-in again.");
  const oauth = await metadata(endpoint, vault);
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: record.clientId,
    code,
    redirect_uri: `${endpoint}/oauth/callback`,
    code_verifier: record.pending.verifier,
    resource: endpoint,
  });
  const response = await (vault.fetch ?? fetch)(oauth.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) return oauthError(response);
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("Cloudflare returned an incomplete sign-in session.");
  const identityResponse = await (vault.fetch ?? fetch)(`${endpoint}/v1/account`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!identityResponse.ok) return oauthError(identityResponse);
  const identity = (await identityResponse.json() as { data?: AccountIdentity }).data;
  if (!identity?.accountId) throw new Error("Cloudflare did not return an account identity.");
  await vault.write({
    clientId: record.clientId,
    registrationProfile: record.registrationProfile,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 900) * 1000,
    accountId: identity.accountId,
    email: identity.email ?? undefined,
  });
  return identity;
}

const refreshes = new WeakMap<OAuthVault, Promise<string | null>>();

export function getCloudflareAccessToken(apiUrl: string, vault: OAuthVault): Promise<string | null> {
  const active = refreshes.get(vault);
  if (active) return active;
  const pending = refreshCloudflareAccessToken(apiUrl, vault).finally(() => {
    if (refreshes.get(vault) === pending) refreshes.delete(vault);
  });
  refreshes.set(vault, pending);
  return pending;
}

async function refreshCloudflareAccessToken(apiUrl: string, vault: OAuthVault): Promise<string | null> {
  const endpoint = apiEndpoint(apiUrl);
  const record = await vault.read();
  if (!record?.accessToken || !record.refreshToken || !record.clientId || !record.accountId) return null;
  if ((record.expiresAt ?? 0) > Date.now() + 60_000) return record.accessToken;
  let oauth: OAuthMetadata;
  try { oauth = await metadata(endpoint, vault); } catch { return null; }
  let response: Response;
  try {
    response = await (vault.fetch ?? fetch)(oauth.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: record.clientId,
        refresh_token: record.refreshToken,
        resource: endpoint,
      }),
    });
  } catch {
    // Keep the refresh token when offline; local reads and writes still work.
    return null;
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) await vault.clear();
    return null;
  }
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token) return null;
  await vault.write({
    ...record,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? record.refreshToken,
    expiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 900) * 1000,
    pending: undefined,
  });
  return tokens.access_token;
}

export async function signOutCloudflare(apiUrl: string, vault: OAuthVault): Promise<void> {
  const endpoint = apiEndpoint(apiUrl);
  // A rotating refresh must finish before credentials can be cleared.
  await refreshes.get(vault)?.catch(() => null);
  const record = await vault.read();
  if (!record?.refreshToken || !record.clientId) { await vault.clear(); return; }
  try {
    const oauth = await metadata(endpoint, vault);
    if (oauth.revocation_endpoint) {
      await (vault.fetch ?? fetch)(oauth.revocation_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: record.refreshToken, client_id: record.clientId, token_type_hint: "refresh_token" }),
      });
    }
  } catch { /* Local sign-out still succeeds when the network is unavailable. */ }
  finally { await vault.clear(); }
}
