import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  Copy,
  Maximize2,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import initSqlJs from "sql.js/dist/sql-asm.js";
import { SqlJsExecutor } from "@entanglement/core";
import {
  beginCloudflareSignIn,
  completeCloudflareSignIn,
  getCloudflareAccessToken,
  signOutCloudflare,
  type OAuthRecord,
  type OAuthVault,
} from "@tunnel/shared/singularity-auth";
import {
  openSingularity,
  singularityEntryContent,
  singularityEntryText,
  rawQuanta,
  singularityEntries,
  singularitySpaces,
  type RawQuanta,
  type SingularityEntry,
  type SingularitySpaceRecord,
} from "@tunnel/shared/singularity";
import { singularityNativeFetch } from "./singularity-http";
import { bridge, native } from "./bridge";
import { quantaSlot } from "./layout";
const endpoint =
  (import.meta.env.EXPO_PUBLIC_SINGULARITY_ENDPOINT as string | undefined)
    ?.trim()
    .replace(/\/$/, "") ?? "";
const vault: OAuthVault = {
  fetch: native
    ? singularityNativeFetch("singularity_auth_request")
    : undefined,
  async read() {
    const raw = await bridge.singularitySecret();
    return raw ? (JSON.parse(raw) as OAuthRecord) : null;
  },
  async write(value) {
    await bridge.setSingularitySecret(JSON.stringify(value));
  },
  clear: () => bridge.clearSingularitySecret(),
};
function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
export default function SingularityPanel({
  view = "quanta",
  onOpenAccount,
}: {
  view?: "quanta" | "account" | "hidden";
  onOpenAccount: () => void;
}) {
  const [record, setRecord] = useState<OAuthRecord | null>(null);
  const [runtime, setRuntime] = useState<Awaited<
    ReturnType<typeof openSingularity>
  > | null>(null);
  const [raw, setRaw] = useState<RawQuanta[]>([]);
  const [spaces, setSpaces] = useState<SingularitySpaceRecord[]>([]);
  const [entries, setEntries] = useState<SingularityEntry[]>([]);
  const [section, setSection] = useState<"raw" | "structured">("raw");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [selectedSpace, setSelectedSpace] = useState("");
  const [newSpace, setNewSpace] = useState(false);
  const [expanded, setExpanded] = useState<{
    title?: string;
    body: string;
  } | null>(null);
  const [menu, setMenu] = useState<{
    q: RawQuanta;
    left: number;
    top: number;
    up: boolean;
  } | null>(null);
  const [entryBody, setEntryBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Connecting…");
  const [error, setError] = useState("");
  async function acceptCallback(url: string) {
    try {
      const identity = await completeCloudflareSignIn(endpoint, url, vault);
      const saved = await vault.read();
      setRecord(saved);
      setError(`Signed in as ${identity.email ?? "your Cloudflare account"}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!native) return;
    let stop: (() => void) | undefined;
    void getCurrent().then((urls) => {
      for (const url of urls ?? [])
        if (url.startsWith("tunnel://singularity-auth"))
          void acceptCallback(url);
    });
    void onOpenUrl((urls) => {
      for (const url of urls)
        if (url.startsWith("tunnel://singularity-auth"))
          void acceptCallback(url);
    }).then((unlisten) => {
      stop = unlisten;
    });
    void vault
      .read()
      .then(setRecord)
      .catch((e) => setError((e as Error).message));
    return () => stop?.();
  }, []);
  useEffect(() => {
    setRaw([]);
    setSpaces([]);
    setEntries([]);
    setSelectedSpace("");
    setText("");
    setEntryBody("");
    setSpaceName("");
    if (!record || !endpoint) return;
    let live = true;
    let opened: Awaited<ReturnType<typeof openSingularity>> | null = null;
    void (async () => {
      const token = await getCloudflareAccessToken(endpoint, vault);
      const latest = await vault.read();
      if (!live || !latest?.accountId) {
        if (live) setRecord(latest);
        return;
      }
      const accountKey = await crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(latest.accountId))
        .then((b) =>
          Array.from(new Uint8Array(b), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join(""),
        );
      const SQL = await initSqlJs();
      const saved = await bridge.loadSingularityDb(accountKey);
      const local = saved
        ? new SQL.Database(new Uint8Array(saved))
        : new SQL.Database();
      const executor = new SqlJsExecutor(local, {
        persist: (bytes) => bridge.saveSingularityDb(accountKey, bytes),
        persistDelayMs: 250,
      });
      opened = await openSingularity({
        endpoint,
        session: {
          accessToken: () => getCloudflareAccessToken(endpoint, vault),
        },
        accountId: latest.accountId,
        deviceLabel: "Tunnel desktop",
        executor,
        request: native
          ? singularityNativeFetch("singularity_sync_request")
          : undefined,
      });
      if (!live) {
        await opened.dispose();
        return;
      }
      setRuntime(opened);
      setError("");
    })().catch((e) => {
      if (live) setError((e as Error).message);
    });
    return () => {
      live = false;
      if (opened) void opened.dispose();
      setRuntime(null);
    };
  }, [record?.accountId]);
  useEffect(() => {
    if (!runtime) return;
    const sync = runtime.db.sync;
    const updateSync = (status = sync?.status) =>
      setSyncLabel(
        status?.problem?.kind === "offline"
          ? "Offline · saved locally"
          : status?.problem
            ? "Sync needs attention"
            : status?.activity === "pushing" || status?.activity === "pulling"
              ? "Syncing…"
              : "Up to date",
      );
    updateSync();
    const stopSync = sync?.onStatus(updateSync);
    const stopRaw = runtime.db
      .query(rawQuanta)
      .orderBy("createdAt", { descending: true })
      .watch(setRaw, (e) => setError((e as Error).message));
    const stopSpaces = runtime.db
      .query(singularitySpaces)
      .orderBy("updatedAt", { descending: true })
      .watch(
        (rows) => {
          setSpaces(rows);
          setSelectedSpace((previous) =>
            rows.some((row) => row.id === previous) ? previous : "",
          );
        },
        (e) => setError((e as Error).message),
      );
    const stopEntries = runtime.db
      .query(singularityEntries)
      .orderBy("updatedAt", { descending: true })
      .watch(setEntries, (e) => setError((e as Error).message));
    return () => {
      stopRaw();
      stopSpaces();
      stopEntries();
      stopSync?.();
    };
  }, [runtime]);
  const visibleRaw = useMemo(
    () =>
      raw.filter((q) => q.text.toLowerCase().includes(search.toLowerCase())),
    [raw, search],
  );
  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (q) =>
          q.spaceId === selectedSpace &&
          `${q.title} ${q.body}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [entries, selectedSpace, search],
  );
  async function signIn() {
    if (!endpoint) {
      setError("Set EXPO_PUBLIC_SINGULARITY_ENDPOINT and restart Tunnel.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const url = await beginCloudflareSignIn(endpoint, vault, randomBytes);
      if (!native) throw new Error("Open the Tunnel desktop app to sign in.");
      await openUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addRaw() {
    const value = text.trim();
    if (!runtime || !value) return;
    setBusy(true);
    try {
      await runtime.db.write((tx) =>
        tx.put(rawQuanta, {
          id: crypto.randomUUID(),
          text: value,
          createdAt: Date.now(),
          sourceDevice: "desktop",
        }),
      );
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addSpace() {
    const name = spaceName.trim();
    if (!runtime || !name) return;
    const now = Date.now();
    const value = {
      id: crypto.randomUUID(),
      name,
      description: "",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await runtime.db.write((tx) => tx.put(singularitySpaces, value));
      setSpaceName("");
      setSelectedSpace(value.id);
      setNewSpace(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function addEntry() {
    if (!runtime || busy || !selectedSpace || !entryBody.trim()) return;
    setBusy(true);
    const now = Date.now();
    const value = {
      id: crypto.randomUUID(),
      spaceId: selectedSpace,
      ...singularityEntryContent(entryBody.trim()),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await runtime.db.write(async (tx) => {
        await tx.put(singularityEntries, value);
        const space = await tx.get(singularitySpaces, selectedSpace);
        if (space)
          await tx.put(singularitySpaces, { ...space, updatedAt: now });
      });
      setEntryBody("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!menu && !expanded && !newSpace) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setExpanded(null);
        setNewSpace(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu, expanded, newSpace]);
  async function move(q: RawQuanta, spaceId: string) {
    if (!runtime) return;
    const now = Date.now();
    try {
      await runtime.db.write(async (tx) => {
        await tx.put(singularityEntries, {
          id: q.id,
          spaceId,
          ...singularityEntryContent(q.text),
          createdAt: q.createdAt,
          updatedAt: now,
        });
        await tx.delete(rawQuanta, q.id);
        const space = await tx.get(singularitySpaces, spaceId);
        if (space)
          await tx.put(singularitySpaces, { ...space, updatedAt: now });
      });
      setMenu(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const copy = (value: string) =>
    void bridge.copy(value).catch((e) => setError(String(e)));
  return (
    <section className="singularity-panel" hidden={view === "hidden"}>
      {view === "account" ? (
        <div className="settings-card account-card">
          <h2>Cloudflare account</h2>
          <p>Singularity keeps quanta on every device you sign in to.</p>
          {record?.accountId ? (
            <div className="setting-row">
              <div>
                <strong>{record.email ?? "Cloudflare account"}</strong>
                <p>{runtime ? syncLabel : "Opening local vault…"}</p>
              </div>
              <button
                className="soft-button"
                onClick={() => {
                  void signOutCloudflare(endpoint, vault)
                    .then(() => {
                      setRuntime(null);
                      setRecord(null);
                    })
                    .catch((e) => setError(String(e)));
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="soft-button primary-button"
              disabled={busy}
              onClick={() => void signIn()}
            >
              {busy ? "Opening sign-in…" : "Sign in with Cloudflare"}
            </button>
          )}
        </div>
      ) : (
        view === "quanta" && (
          <>
            {!!record?.accountId && (
              <div className="singularity-fixed">
            <div className="singularity-tools">
              <div className="segmented">
                <button
                  className={section === "raw" ? "selected" : ""}
                  onClick={() => {
                    setSection("raw");
                    setMenu(null);
                  }}
                >
                  Quanta
                </button>
                <button
                  className={section === "structured" ? "selected" : ""}
                  onClick={() => {
                    setSection("structured");
                    setSelectedSpace("");
                    setMenu(null);
                  }}
                >
                  Spaces
                </button>
              </div>
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="Search Singularity"
                  placeholder={
                    section === "raw"
                      ? "Search quanta…"
                      : "Search spaces…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <small className="sync-status">
              {runtime ? syncLabel : "Opening local vault…"}
            </small>
              </div>
            )}
            <div className="singularity-scroll">
              {!record?.accountId ? (
                <div className="signed-out-note">
                  <h2>Your quanta, on every device.</h2>
                  <p>
                    Sign in from Settings. What you save here stays on this
                    computer and syncs to your other signed-in devices.
                  </p>
                  <button className="soft-button" onClick={onOpenAccount}>
                    Open account settings
                  </button>
                </div>
              ) : (
                <>
                  {section === "raw" ? (
                    <div className="singularity-grid quanta-grid">
                      {visibleRaw.map((q) => (
                        <article
                          className={"singularity-quanta " + quantaSlot(q.text)}
                          key={q.id}
                        >
                          <p>{q.text}</p>
                          <footer>
                            <small>
                              {q.sourceDevice ?? "Device"} ·{" "}
                              {new Date(q.createdAt).toLocaleString()}
                            </small>
                            <div className="quanta-icon-actions">
                              <button
                                className="icon-button"
                                aria-label="Copy quanta"
                                onClick={() => copy(q.text)}
                              >
                                <Copy size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label="Expand quanta"
                                onClick={() => setExpanded({ body: q.text })}
                              >
                                <Maximize2 size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label="Move quanta to a space"
                                aria-expanded={menu?.q.id === q.id}
                                onClick={(e) => {
                                  const r =
                                    e.currentTarget.getBoundingClientRect();
                                  setMenu({
                                    q,
                                    left: Math.max(
                                      8,
                                      Math.min(
                                        r.right - 240,
                                        window.innerWidth - 248,
                                      ),
                                    ),
                                    top: r.top > 260 ? r.top - 8 : r.bottom + 8,
                                    up: r.top > 260,
                                  });
                                }}
                              >
                                <MoreHorizontal size={18} />
                              </button>
                            </div>
                          </footer>
                        </article>
                      ))}
                      {!visibleRaw.length && (
                        <p className="panel-empty">
                          {search
                            ? "No matching quanta."
                            : "Your shared quanta will appear here."}
                        </p>
                      )}
                    </div>
                  ) : selectedSpace ? (
                    <>
                      <h2 className="space-heading">
                        {spaces.find((s) => s.id === selectedSpace)?.name}
                      </h2>
                      <div className="singularity-grid quanta-grid">
                        {visibleEntries.map((entry) => (
                          <article
                            className={
                              "singularity-quanta " +
                              quantaSlot(singularityEntryText(entry))
                            }
                            key={entry.id}
                          >
                            <p>{singularityEntryText(entry)}</p>
                            <footer>
                              <small>
                                {new Date(entry.updatedAt).toLocaleString()}
                              </small>
                              <div className="quanta-icon-actions">
                                <button
                                  className="icon-button"
                                  aria-label="Copy entry"
                                  onClick={() =>
                                    copy(singularityEntryText(entry))
                                  }
                                >
                                  <Copy size={17} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Expand entry"
                                  onClick={() =>
                                    setExpanded({
                                      title: "Quanta",
                                      body: singularityEntryText(entry),
                                    })
                                  }
                                >
                                  <Maximize2 size={17} />
                                </button>
                              </div>
                            </footer>
                          </article>
                        ))}
                        {!visibleEntries.length && (
                          <p className="panel-empty">
                            {search
                              ? "No matching entries."
                              : "Add the first quanta to this space."}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="singularity-grid quanta-grid">
                      {spaces
                        .filter((s) =>
                          s.name.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((s) => (
                          <button
                            className="space-card"
                            key={s.id}
                            onClick={() => {
                              setSelectedSpace(s.id);
                              setSearch("");
                            }}
                          >
                            <strong>{s.name}</strong>
                            <small>
                              {entries.filter((e) => e.spaceId === s.id).length}{" "}
                              entries
                            </small>
                          </button>
                        ))}
                      {!spaces.length && (
                        <p className="panel-empty">
                          Create a space to organize your quanta.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {record?.accountId && (section === "raw" || selectedSpace) && (
              <form
                className="singularity-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (section === "raw" ? addRaw() : addEntry());
                }}
              >
                <input
                  aria-label="New quanta"
                  placeholder={
                    section === "raw"
                      ? "A thought for every device"
                      : "Add quanta here"
                  }
                  value={section === "raw" ? text : entryBody}
                  onChange={(e) =>
                    section === "raw"
                      ? setText(e.target.value)
                      : setEntryBody(e.target.value)
                  }
                />
                <button
                  aria-label="Save quanta"
                  disabled={
                    !runtime ||
                    busy ||
                    !(section === "raw" ? text : entryBody).trim()
                  }
                >
                  <ArrowUp size={23} />
                </button>
              </form>
            )}
            {record?.accountId &&
              section === "structured" &&
              !selectedSpace && (
                <button
                  className="new-space-button"
                  aria-label="New space"
                  disabled={!runtime}
                  onClick={() => setNewSpace(true)}
                >
                  <Plus size={24} />
                </button>
              )}
          </>
        )
      )}
      {error && view !== "hidden" && (
        <p className="singularity-error" role="status">
          {error}
        </p>
      )}
      {view === "quanta" &&
        menu &&
        createPortal(
          <div className="move-menu-scrim" onClick={() => setMenu(null)}>
            <div
              className="move-menu"
              role="menu"
              aria-label="Move to a space"
              style={{
                left: menu.left,
                top: menu.top,
                transform: menu.up ? "translateY(-100%)" : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <strong>Move to space</strong>
              {spaces.map((s) => (
                <button
                  role="menuitem"
                  key={s.id}
                  onClick={() => void move(menu.q, s.id)}
                >
                  {s.name}
                </button>
              ))}
              {!spaces.length && <p>Create a space first.</p>}
            </div>
          </div>,
          document.body,
        )}
      {view === "quanta" && newSpace && (
        <div className="modal-scrim" onClick={() => setNewSpace(false)}>
          <form
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="New space"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void addSpace();
            }}
          >
            <header>
              <h2>New space</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => setNewSpace(false)}
              >
                <X />
              </button>
            </header>
            <input
              autoFocus
              aria-label="Space name"
              placeholder="Space name"
              value={spaceName}
              maxLength={100}
              onChange={(e) => setSpaceName(e.target.value)}
            />
            <button
              className="soft-button primary-button"
              disabled={!runtime || !spaceName.trim()}
            >
              Create space
            </button>
          </form>
        </div>
      )}
      {view === "quanta" && expanded && (
        <div className="modal-scrim" onClick={() => setExpanded(null)}>
          <section
            className="quanta-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Full quanta"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>{expanded.title ?? "Quanta"}</h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close"
                onClick={() => setExpanded(null)}
              >
                <X />
              </button>
            </header>
            <p className="full-quanta-text">{expanded.body}</p>
            <button
              className="icon-button"
              aria-label="Copy quanta"
              onClick={() => copy(expanded.body)}
            >
              <Copy />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
