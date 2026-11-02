
import { DurableObject } from "cloudflare:workers";

interface Env {
  SPACES: DurableObjectNamespace<SingularitySpace>;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUDIENCE: string;
}

interface AccessClaims { sub?: string; aud?: string | string[]; iss?: string; exp?: number; }
interface AccessJwk extends JsonWebKey { kid?: string; }
interface CachedKeys { until: number; keys: AccessJwk[]; }
let cachedKeys: CachedKeys | undefined;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
    if (request.method === "GET" && url.pathname === "/oauth/callback") return oauthCallback(url);
    const isHintSocket = url.pathname === "/v1/hints" && request.headers.get("Upgrade") === "websocket";
    if (isHintSocket) {
      const account = url.searchParams.get("account");
      const ticket = url.searchParams.get("ticket");
      if (!account || !ticket || account.length > 256) return json({ error: "Invalid hint ticket." }, 401);
      const id = env.SPACES.idFromName(account);
      const headers = new Headers(request.headers);
      headers.set("x-hint-account", account);
      headers.set("x-hint-ticket", ticket);
      return env.SPACES.get(id).fetch(new Request(request, { headers }));
    }

    const claims = await accessClaims(request, env);
    if (!claims?.sub) return json({ error: "Sign in with Cloudflare Access." }, 401);
    if (request.method === "GET" && url.pathname === "/v1/account") {
      return json({ data: { accountId: claims.sub, email: claims.email ?? null } });
    }
    const id = env.SPACES.idFromName(claims.sub);
    const headers = new Headers(request.headers);
    headers.set("x-singularity-account", claims.sub);
    headers.set("x-singularity-email", typeof claims.email === "string" ? claims.email : "");
    return cors(await env.SPACES.get(id).fetch(new Request(request, { headers })));
  },
};

export class SingularitySpace extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private accountId = "";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS head (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL,
        schema_version INTEGER NOT NULL, min_version INTEGER NOT NULL,
        state_digest TEXT NOT NULL, updated_at TEXT NOT NULL, compacted_through INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS commits (
        revision INTEGER PRIMARY KEY, commit_id TEXT NOT NULL UNIQUE, request_json TEXT NOT NULL, committed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checkpoints (
        revision INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL, state_digest TEXT NOT NULL,
        entities_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS restore_points (
        revision INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT, pinned INTEGER NOT NULL,
        device_label TEXT, created_at TEXT NOT NULL, PRIMARY KEY(revision, kind)
      );
      CREATE TABLE IF NOT EXISTS hint_tickets (ticket TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket" && url.pathname === "/v1/hints") return this.upgradeHint(request);
    this.accountId = request.headers.get("x-singularity-account") ?? "";
    if (!this.accountId) return json({ error: "Unauthorized." }, 401);
    try {
      const path = url.pathname;
      if (request.method === "GET" && path === "/v1/head") return this.readHead();
      if (request.method === "GET" && path === "/v1/commits") return this.readCommits(url);
      if (request.method === "POST" && path === "/v1/submit") return await this.submit(request);
      if (request.method === "GET" && path === "/v1/checkpoint") return this.readCheckpoint(url);
      if (request.method === "POST" && path === "/v1/checkpoint") return await this.putCheckpoint(request);
      if (request.method === "GET" && path === "/v1/restore-points") return this.readRestorePoints();
      if (request.method === "POST" && path === "/v1/restore-points") return await this.putRestorePoint(request);
      if (request.method === "DELETE" && path === "/v1/restore-points") return await this.deleteRestorePoints(request);
      if (request.method === "POST" && path === "/v1/compact") return await this.compact(request);
      if (request.method === "POST" && path === "/v1/hint-ticket") return await this.createHintTicket();
      return json({ error: "Not found." }, 404);
    } catch (error) {
      console.error("Singularity request failed", error);
      return json({ error: error instanceof Error ? error.message : "Request failed." }, 400);
    }
  }

  private readHead(): Response {
    const row = this.sql.exec("SELECT * FROM head WHERE singleton=1").toArray()[0];
    return json({ data: row ? headJson(row) : null });
  }

  private readCommits(url: URL): Response {
    const after = integer(url.searchParams.get("after"), 0);
    const upTo = integer(url.searchParams.get("upTo"), 0);
    const limit = Math.min(500, Math.max(1, integer(url.searchParams.get("limit"), 200)));
    const head = this.sql.exec("SELECT compacted_through FROM head WHERE singleton=1").toArray()[0];
    const compacted = Number(head?.compacted_through ?? 0);
    if (after < compacted) return json({ error: "Commit history was compacted." }, 410);
    const rows = this.sql.exec("SELECT revision, request_json, committed_at FROM commits WHERE revision>? AND revision<=? ORDER BY revision LIMIT ?", after, upTo, limit).toArray();
    const values = rows.map((r) => ({ revision: Number(r.revision), request: JSON.parse(String(r.request_json)), committedAt: String(r.committed_at) }));
    if ((upTo > after && !values.length) || (values.length && Number(values[0]?.revision) !== after + 1)) return json({ error: "Commit history has a gap." }, 410);
    return json({ data: values });
  }

  private async submit(request: Request): Promise<Response> {
    const value = await request.json() as CommitRequest;
    if (!validCommit(value)) return json({ error: "Invalid commit." }, 400);
    const duplicate = this.sql.exec("SELECT revision FROM commits WHERE commit_id=?", value.commitId).toArray()[0];
    if (duplicate) return json({ data: { kind: "accepted", revision: Number(duplicate.revision) } });
    const head = this.sql.exec("SELECT * FROM head WHERE singleton=1").toArray()[0];
    const revision = Number(head?.revision ?? 0);
    const minVersion = Number(head?.min_version ?? value.compatibleSince);
    if (value.schemaVersion < minVersion) return json({ data: { kind: "rejected", reason: "schemaTooOld" } });
    if (value.parent !== revision) return json({ data: { kind: "conflict", headRevision: revision } });
    if (value.changes.length > 10000 || JSON.stringify(value).length > 2_000_000) return json({ data: { kind: "rejected", reason: "quotaExceeded" } });
    const next = revision + 1;
    const now = new Date().toISOString();
    this.sql.exec("INSERT INTO commits(revision,commit_id,request_json,committed_at) VALUES(?,?,?,?)", next, value.commitId, JSON.stringify(value), now);
    this.sql.exec(`INSERT INTO head(singleton,revision,schema_version,min_version,state_digest,updated_at,compacted_through)
      VALUES(1,?,?,?,?,?,0) ON CONFLICT(singleton) DO UPDATE SET revision=excluded.revision,
      schema_version=excluded.schema_version,min_version=excluded.min_version,state_digest=excluded.state_digest,updated_at=excluded.updated_at`,
      next, value.schemaVersion, revision === 0 ? value.compatibleSince : Math.max(minVersion, value.compatibleSince), value.stateDigest, now);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(JSON.stringify({ type: "head", revision: next })); } catch { /* Closed socket. */ }
    }
    return json({ data: { kind: "accepted", revision: next } });
  }

  private readCheckpoint(url: URL): Response {
    const revision = integer(url.searchParams.get("atOrBefore"), 0);
    const row = this.sql.exec("SELECT * FROM checkpoints WHERE revision<=? ORDER BY revision DESC LIMIT 1", revision).toArray()[0];
    return json({ data: row ? checkpointJson(row) : null });
  }

  private async putCheckpoint(request: Request): Promise<Response> {
    const value = await request.json() as CheckpointInput;
    const head = this.sql.exec("SELECT revision FROM head WHERE singleton=1").toArray()[0];
    if (!validCheckpoint(value) || value.revision > Number(head?.revision ?? 0)) return json({ error: "Invalid checkpoint." }, 400);
    const committed = value.revision === 0 ? null : this.sql.exec("SELECT request_json FROM commits WHERE revision=?", value.revision).toArray()[0];
    if (value.revision > 0 && (!committed || JSON.parse(String(committed.request_json)).stateDigest !== value.stateDigest)) return json({ error: "Checkpoint does not match its commit." }, 409);
    const existing = this.sql.exec("SELECT state_digest FROM checkpoints WHERE revision=?", value.revision).toArray()[0];
    if (existing && existing.state_digest !== value.stateDigest) return json({ error: "Checkpoint digest mismatch." }, 409);
    this.sql.exec("INSERT OR IGNORE INTO checkpoints(revision,schema_version,state_digest,entities_json,created_at) VALUES(?,?,?,?,?)",
      value.revision, value.schemaVersion, value.stateDigest, JSON.stringify(value.entities), new Date().toISOString());
    return json({ data: null });
  }

  private readRestorePoints(): Response {
    const rows = this.sql.exec("SELECT * FROM restore_points ORDER BY revision DESC").toArray();
    return json({ data: rows.map((r) => ({ revision: Number(r.revision), kind: String(r.kind), label: r.label ?? null,
      pinned: Number(r.pinned) === 1, deviceLabel: r.device_label ?? null, createdAt: String(r.created_at) })) });
  }

  private async putRestorePoint(request: Request): Promise<Response> {
    const point = await request.json() as RestorePointInput;
    const head = this.sql.exec("SELECT revision FROM head WHERE singleton=1").toArray()[0];
    if (!Number.isInteger(point.revision) || point.revision < 0 || point.revision > Number(head?.revision ?? 0) || !RESTORE_KINDS.has(point.kind)) return json({ error: "Invalid restore point." }, 400);
    this.sql.exec(`INSERT INTO restore_points(revision,kind,label,pinned,device_label,created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(revision,kind) DO UPDATE SET label=excluded.label,pinned=excluded.pinned,device_label=excluded.device_label`,
      point.revision, point.kind, point.label, point.pinned ? 1 : 0, point.deviceLabel, new Date().toISOString());
    return json({ data: null });
  }

  private async deleteRestorePoints(request: Request): Promise<Response> {
    const keys = await request.json() as { revision: number; kind: string }[];
    if (!Array.isArray(keys) || keys.length > 1000) return json({ error: "Invalid restore point keys." }, 400);
    for (const key of keys) if (Number.isInteger(key.revision) && RESTORE_KINDS.has(key.kind as RestorePointKind)) this.sql.exec("DELETE FROM restore_points WHERE revision=? AND kind=?", key.revision, key.kind);
    return json({ data: null });
  }

  private async compact(request: Request): Promise<Response> {
    const { anchor } = await request.json() as { anchor: number };
    if (!Number.isInteger(anchor) || anchor < 0) return json({ error: "Invalid compaction anchor." }, 400);
    const checkpoint = this.sql.exec("SELECT revision FROM checkpoints WHERE revision=?", anchor).toArray()[0];
    if (!checkpoint) return json({ error: "A checkpoint is required at the anchor." }, 409);
    const pinned = this.sql.exec("SELECT 1 FROM restore_points WHERE revision<? AND pinned=1 LIMIT 1", anchor).toArray()[0];
    if (pinned) return json({ error: "A pinned restore point is older than the anchor." }, 409);
    this.sql.exec("DELETE FROM commits WHERE revision<=?", anchor);
    this.sql.exec("DELETE FROM checkpoints WHERE revision<?", anchor);
    this.sql.exec("DELETE FROM restore_points WHERE revision<? AND pinned=0", anchor);
    this.sql.exec("UPDATE head SET compacted_through=? WHERE singleton=1", anchor);
    return json({ data: null });
  }

  private async createHintTicket(): Promise<Response> {
    const ticketBytes = crypto.getRandomValues(new Uint8Array(24));
    const ticket = [...ticketBytes].map((v) => v.toString(16).padStart(2, "0")).join("");
    this.sql.exec("DELETE FROM hint_tickets WHERE expires_at<?", Date.now());
    this.sql.exec("INSERT INTO hint_tickets(ticket,expires_at) VALUES(?,?)", ticket, Date.now() + 60_000);
    return json({ data: { ticket, account: this.accountId, expiresAt: Date.now() + 60_000 } });
  }

  private upgradeHint(request: Request): Response {
    const account = request.headers.get("x-hint-account");
    const ticket = request.headers.get("x-hint-ticket");
    if (!account || !ticket) return new Response("Unauthorized", { status: 401 });
    const row = this.sql.exec("SELECT expires_at FROM hint_tickets WHERE ticket=?", ticket).toArray()[0];
    if (!row || Number(row.expires_at) < Date.now()) return new Response("Unauthorized", { status: 401 });
    this.sql.exec("DELETE FROM hint_tickets WHERE ticket=?", ticket);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["singularity-hints"]);
    return new Response(null, { status: 101, webSocket: client });
  }
}

const RESTORE_KINDS = new Set(["commit", "daily", "manual", "beforeRestore", "beforeOverwrite"]);
type RestorePointKind = "commit" | "daily" | "manual" | "beforeRestore" | "beforeOverwrite";
interface CommitRequest { commitId: string; parent: number; schemaVersion: number; compatibleSince: number; deviceId: string; deviceLabel: string | null; clientTime: number | null; message: string | null; stateDigest: string; changes: unknown[]; }
interface CheckpointInput { revision: number; schemaVersion: number; stateDigest: string; entities: unknown[]; }
interface RestorePointInput { revision: number; kind: RestorePointKind; label: string | null; pinned: boolean; deviceLabel: string | null; }
function validCommit(v: CommitRequest): boolean { return !!v && typeof v.commitId === "string" && v.commitId.length <= 128 && Number.isInteger(v.parent) && v.parent >= 0 && Number.isInteger(v.schemaVersion) && Number.isInteger(v.compatibleSince) && typeof v.deviceId === "string" && /^[a-f0-9]{64}$/i.test(v.stateDigest) && Array.isArray(v.changes); }
function validCheckpoint(v: CheckpointInput): boolean { return !!v && Number.isInteger(v.revision) && v.revision >= 0 && Number.isInteger(v.schemaVersion) && /^[a-f0-9]{64}$/i.test(v.stateDigest) && Array.isArray(v.entities); }
function integer(value: string | null, fallback: number): number { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : fallback; }
function oauthCallback(url: URL): Response {
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const description = url.searchParams.get("error_description");
  if (!state || state.length > 256 || (code && code.length > 4096)) return json({ error: "Invalid OAuth callback." }, 400);
  const target = new URL("tunnel://singularity-auth");
  target.searchParams.set("state", state);
  if (code) target.searchParams.set("code", code);
  if (error) target.searchParams.set("error", error.slice(0, 256));
  if (description) target.searchParams.set("error_description", description.slice(0, 512));
  return new Response(null, { status: 302, headers: { Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
function json(value: unknown, status = 200): Response { return cors(new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } })); }
function cors(response: Response): Response { const headers = new Headers(response.headers); headers.set("Access-Control-Allow-Origin", "*"); headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS"); headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type"); headers.set("Access-Control-Max-Age", "86400"); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
function headJson(row: Record<string, SqlStorageValue>): Record<string, unknown> { return { revision: Number(row.revision), schemaVersion: Number(row.schema_version), minVersion: Number(row.min_version), stateDigest: row.state_digest, updatedAt: row.updated_at }; }
function checkpointJson(row: Record<string, SqlStorageValue>): Record<string, unknown> { return { revision: Number(row.revision), schemaVersion: Number(row.schema_version), stateDigest: row.state_digest, entities: JSON.parse(String(row.entities_json)), createdAt: row.created_at }; }

async function accessClaims(request: Request, env: Env): Promise<(AccessClaims & { email?: string }) | null> {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    const header = JSON.parse(new TextDecoder().decode(base64url(headerPart))) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const keys = await accessKeys(env.ACCESS_TEAM_DOMAIN);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, arrayBuffer(base64url(signaturePart)), new TextEncoder().encode(`${headerPart}.${payloadPart}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(base64url(payloadPart))) as AccessClaims & { email?: string };
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}` || !audience.includes(env.ACCESS_AUDIENCE) || !claims.sub || !claims.exp || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}

async function accessKeys(domain: string): Promise<AccessJwk[]> {
  if (cachedKeys && cachedKeys.until > Date.now()) return cachedKeys.keys;
  const response = await fetch(`https://${domain}/cdn-cgi/access/certs`, { cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit);
  if (!response.ok) throw new Error("Cannot load Cloudflare Access signing keys.");
  const data = await response.json() as { keys?: AccessJwk[] };
  cachedKeys = { until: Date.now() + 5 * 60_000, keys: data.keys ?? [] };
  return cachedKeys.keys;
}

function base64url(value: string): Uint8Array { const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (c) => c.charCodeAt(0)); }
function arrayBuffer(bytes: Uint8Array): ArrayBuffer { return Uint8Array.from(bytes).buffer; }
