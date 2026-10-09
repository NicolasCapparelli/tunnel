import { useCallback, useEffect, useRef, useState } from "react";
import { useAuroraController, useAuroraState } from "@aurora/react";
import {
  themes,
  themeSelection,
  type ThemePreferences,
} from "@tunnel/shared/theme";
import {
  validateQuanta,
  validateAttachments,
  type Attachment,
  type Pairing,
  type Transfer,
} from "@tunnel/shared";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clipboard,
  Copy,
  History,
  Link2,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  X,
  Maximize2,
  Download,
} from "lucide-react";
import { bridge, native, type Snapshot } from "./bridge";
import {
  composerPrompts,
  nextPrompt,
  validDeviceName,
} from "@tunnel/shared/composer";

type Page = "send" | "history" | "devices" | "settings";
const pages = [
  { id: "send", label: "Tunnel", icon: Plus },
  { id: "history", label: "Transfer history", icon: History },
  { id: "devices", label: "Linked devices", icon: Link2 },
  { id: "settings", label: "Appearance & settings", icon: Settings2 },
] as const;
function Orbit({ small = false }: { small?: boolean }) {
  return (
    <span className={`orbit ${small ? "small" : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}
function time(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AttachmentTile({
  q,
  a,
  index,
  notify,
}: {
  q?: Transfer;
  a: Attachment;
  index: number;
  notify: (e: unknown) => void;
}) {
  const [src, setSrc] = useState<string>();
  const tile = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!a.mimeType.startsWith("image/")) return;
    if (a.data) {
      setSrc("data:" + a.mimeType + ";base64," + a.data);
      return;
    }
    let live = true;
    const load = () => {
      (q ? bridge.previewAttachment(q.id, index) : bridge.previewDraft(a.uri!))
        .then((url) => {
          if (live) setSrc(url);
        })
        .catch(() => {});
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "120px" },
    );
    if (tile.current) observer.observe(tile.current);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [q?.id, index, a.uri, a.data]);
  return (
    <div className="quanta-attachment" ref={tile}>
      <div className="attachment-art">
        {src ? <img src={src} alt={a.name} /> : <Paperclip size={24} />}
      </div>
      <div className="attachment-details">
        <strong title={a.name}>{a.name}</strong>
        <small>
          {a.size >= 1048576
            ? (a.size / 1048576).toFixed(1) + " MB"
            : (a.size / 1024).toFixed(1) + " KB"}
        </small>
      </div>
      {q && (
        <div className="attachment-controls">
          <button
            aria-label={"Copy " + a.name}
            onClick={() =>
              void bridge.copyAttachment(q.id, index).catch(notify)
            }
          >
            <Copy size={16} />
          </button>
          <button
            aria-label={"Save " + a.name}
            onClick={() =>
              void bridge.saveAttachment(q.id, index).catch(notify)
            }
          >
            <Download size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function AttachmentHistory({
  q,
  notify,
}: {
  q: Transfer;
  notify: (e: unknown) => void;
}) {
  return (
    <div className="quanta-gallery">
      {(q.attachments ?? []).map((a, i) => (
        <AttachmentTile key={i} q={q} a={a} index={i} notify={notify} />
      ))}
    </div>
  );
}
export default function App() {
  const [expanded, setExpanded] = useState<Transfer | null>(null);
  const sendRef = useRef<() => void>(() => {});
  const [page, setPage] = useState<Page>("send");
  const [prompt, setPrompt] = useState(0);
  const [arrival, setArrival] = useState(0);
  const [deviceName, setDeviceName] = useState("");
  const [text, setText] = useState(
    () => localStorage.getItem("tunnel-draft") ?? "",
  );
  const [state, setState] = useState<Snapshot | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [pair, setPair] = useState<Pairing | null>(null);
  const [address, setAddress] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | "sent" | "received">("received");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<"unpair" | "history" | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);
  const controller = useAuroraController();
  const aurora = useAuroraState();
  const refresh = useCallback(async () => {
    try {
      const s = await bridge.snapshot();
      setState(s);
      setAddress((a) => (s.addresses.includes(a) ? a : (s.addresses[0] ?? "")));
    } catch (e) {
      setToast(String(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    let disposed = false;
    let stop = () => {};
    bridge
      .subscribe(
        () => void refresh(),
        () => setPage("history"),
        () => setArrival((v) => v + 1),
      )
      .then((f) => {
        if (disposed) f();
        else stop = f;
      });
    return () => {
      disposed = true;
      stop();
    };
  }, [refresh]);
  useEffect(() => {
    localStorage.setItem("tunnel-draft", text);
  }, [text]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const opened = () => {
      if (page === "send") setPrompt(nextPrompt);
    };
    window.addEventListener("focus", opened);
    return () => window.removeEventListener("focus", opened);
  }, [page]);
  useEffect(() => {
    setDeviceName(state?.deviceName ?? "");
  }, [state?.deviceName]);
  const rename = async () => {
    try {
      await bridge.rename(validDeviceName(deviceName));
      await refresh();
      setToast("Device name saved.");
    } catch (e) {
      notify(e);
    }
  };
  const notify = (e: unknown) =>
    setToast(e instanceof Error ? e.message : String(e));
  const send = async (retry?: Transfer) => {
    if (busy) return;
    const draft = retry?.text ?? text;
    try {
      validateQuanta({
        id: retry?.id ?? "draft-quanta",
        text: draft,
        createdAt: Date.now(),
        attachments: retry?.attachments ?? attachments,
      });
    } catch (e) {
      notify(e);
      return;
    }
    if (!state?.connected) {
      setToast("Link your phone and keep both devices on the same Wi-Fi.");
      return;
    }
    const files = retry?.attachments ?? attachments;
    setBusy(true);
    try {
      await bridge.send(draft, retry?.id ?? crypto.randomUUID(), files);
      if (!retry) {
        setText((t) => (t === draft ? "" : t));
        setAttachments((current) => (current === files ? [] : current));
      }
      setPrompt(nextPrompt);
      setToast("Quanta received on " + state.peerName + ".");
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
      await refresh();
    }
  };
  const attachNative = async () => {
    try {
      const files = await bridge.pickAttachments();
      setAttachments((old) => {
        const next = [...old, ...files];
        validateAttachments(next);
        return next;
      });
    } catch (e) {
      notify(e);
    }
  };
  const attach = async (files: FileList | null) => {
    if (!files) return;
    try {
      const metadata = Array.from(files).map((f) => ({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
        uri: "pending",
      }));
      validateAttachments([...attachments, ...metadata]);
      const imported = await Promise.all(
        Array.from(files).map(
          (f) =>
            new Promise<Attachment>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () =>
                reject(new Error("Could not read " + f.name));
              reader.onload = () =>
                resolve({
                  name: f.name,
                  mimeType: f.type || "application/octet-stream",
                  size: f.size,
                  data: String(reader.result).split(",")[1],
                });
              reader.readAsDataURL(f);
            }),
        ),
      );
      setAttachments((old) => {
        const next = [...old, ...imported];
        validateAttachments(next);
        return next;
      });
    } catch (e) {
      notify(e);
    } finally {
      if (picker.current) picker.current.value = "";
    }
  };
  sendRef.current = () => {
    if (page === "send" && !expanded) void send();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        sendRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const paste = async () => {
    try {
      const value = await bridge.readClipboard();
      if (!value) {
        setToast("Your clipboard is empty.");
        return;
      }
      setText((t) => (t ? t + "\n" + value : value));
      input.current?.focus();
    } catch {
      setToast(
        "Clipboard access was denied. You can paste directly into the input.",
      );
    }
  };
  const createPair = async () => {
    setPairBusy(true);
    try {
      setPair(await bridge.pair(address));
    } catch (e) {
      notify(e);
    } finally {
      setPairBusy(false);
    }
  };
  const selectTheme = (changes: Partial<ThemePreferences>) => {
    const p = {
      themeId: aurora.selection.themeId,
      appearance: aurora.selection.appearance,
      ...changes,
    };
    controller.select(themeSelection(p));
    localStorage.setItem("tunnel-theme", JSON.stringify(p));
  };
  const updatePreferences = async (
    changes: Partial<Pick<Snapshot, "autoCopy" | "notifications" | "startup">>,
  ) => {
    if (!state) return;
    const next = { ...state, ...changes };
    try {
      await bridge.preferences(next.autoCopy, next.notifications, next.startup);
      await refresh();
    } catch (e) {
      notify(e);
    }
  };
  const history = state?.history ?? [];
  const connected = state?.connected ?? false;
  const results = history.filter(
    (q) =>
      (filter === "all" || q.direction === filter) &&
      (q.text + " " + (q.attachments ?? []).map((a) => a.name).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const navigate = (p: Page) => {
    if (p === "send" && page !== "send") setPrompt(nextPrompt);
    setPage(p);
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("send");
            }}
          >
            <Orbit small />
            <span>
              Tunnel<span className="brand-dot">.</span>
            </span>
          </a>
        </div>
        <button
          className={`connection-pill ${connected ? "online" : ""}`}
          onClick={() => navigate("devices")}
        >
          <span className="status-dot" />
          {connected
            ? state?.peerName
            : state?.peerName
              ? "Phone offline"
              : "No device linked"}
          <ChevronRight size={14} />
        </button>
      </header>
      <nav className="desktop-sidebar" aria-label="Main navigation">
        {pages.map((p) => (
          <button
            key={p.id}
            className={page === p.id ? "selected" : ""}
            onClick={() => navigate(p.id)}
            aria-current={page === p.id ? "page" : undefined}
          >
            <p.icon size={19} />
            <span>{p.label}</span>
          </button>
        ))}
      </nav>
      <main className="workspace">
        {page !== "send" && (
          <div className="page-heading">
            <div>
              <h1>
                {page === "history" ? (
                  <>
                    A trail of <em>quanta.</em>
                  </>
                ) : page === "devices" ? (
                  <>
                    Meet the <em>other side.</em>
                  </>
                ) : (
                  <>
                    Make it <em>yours.</em>
                  </>
                )}
              </h1>
              <p>
                {page === "history"
                  ? "All quanta you've tunneled"
                  : page === "devices"
                    ? "One scan. Two devices. A much shorter distance."
                    : "Powered by Aurora. Tuned to your comfort."}
              </p>
            </div>
            <span className="page-index">
              0{pages.findIndex((p) => p.id === page) + 1} / 04
            </span>
          </div>
        )}
        {page === "send" && (
          <div className="send-layout">
            <section className="composer-area" aria-label="Compose quanta">
              <div className="composer-row">
                <div className={`quanta-card ${busy ? "tunneling" : ""}`}>
                  <div className="card-caption">
                    <span>
                      <i /> YOUR QUANTA
                    </span>
                    <span>
                      TEXT <span className="tiny-separator">/</span> 01
                    </span>
                  </div>
                  <div className="input-area">
                    <textarea
                      ref={input}
                      aria-label="Quanta text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      spellCheck
                      placeholder=" "
                    />
                    {!text && !attachments.length && (
                      <div className="empty-quanta">
                        <Orbit />
                        <h2>{composerPrompts[prompt]}</h2>
                        <p>Tap here and let a thought in.</p>
                      </div>
                    )}
                  </div>
                  {!!attachments.length && (
                    <div
                      className="composer-carousel"
                      aria-label="Quanta attachments"
                    >
                      {attachments.map((a, i) => (
                        <div className="composer-attachment" key={a.uri ?? i}>
                          <AttachmentTile a={a} index={i} notify={notify} />
                          <button
                            className="remove-attachment"
                            disabled={busy}
                            aria-label={"Remove " + a.name}
                            onClick={() =>
                              setAttachments((old) =>
                                old.filter((_, n) => n !== i),
                              )
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="card-footer">
                    <span>
                      {text ? `${text.length.toLocaleString()} characters` : ""}
                    </span>
                    <span className="shortcut">Ctrl ↵</span>
                  </div>
                  <div className="particle-field" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          left: `${10 + i * 7}%`,
                          animationDelay: `${i * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <input
                type="file"
                hidden
                multiple
                ref={picker}
                onChange={(e) => void attach(e.target.files)}
              />
              <div className="composer-actions">
                <button
                  className="attachment-button"
                  onClick={() =>
                    native ? void attachNative() : picker.current?.click()
                  }
                  disabled={busy}
                >
                  <Paperclip size={22} />
                  <span>Attach something</span>
                </button>
                <button onClick={() => void paste()}>
                  <Clipboard size={22} />
                  <span>Paste from clipboard</span>
                  <span className="keycap">↙</span>
                </button>
              </div>
              <button
                className="tunnel-button"
                disabled={
                  (!text.trim() && !attachments.length) || !connected || busy
                }
                onClick={() => void send()}
              >
                <ArrowUpRight size={20} />
                {busy ? "Tunneling…" : "Tunnel"}
                <span>Ctrl + Enter</span>
              </button>
            </section>
            <aside className="side-panel history-panel">
              <div className="panel-heading">
                <h2>Recent quanta</h2>
                <button
                  className="text-link"
                  onClick={() => navigate("history")}
                >
                  View all <ChevronRight size={16} />
                </button>
              </div>
              <div className="recent-tools">
                <div className="segmented">
                  {(["received", "sent", "all"] as const).map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "selected" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search quanta…"
                    aria-label="Search recent history"
                  />
                </label>
              </div>
              <div className="recent-list">
                {results.slice(0, 20).map((q) => (
                  <article
                    className="recent-quanta"
                    key={q.id}
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest("button") ||
                        window.getSelection()?.toString()
                      )
                        return;
                      if (q.attachments?.length === 1)
                        void bridge
                          .copyAttachment(q.id, 0)
                          .then(() => setToast("Copied."))
                          .catch(notify);
                      else if (q.attachments?.length) setExpanded(q);
                      else
                        void bridge
                          .copy(q.text)
                          .then(() => setToast("Copied."))
                          .catch(notify);
                    }}
                  >
                    <div className="recent-heading">
                      <span className="transfer-meta">
                        {q.direction === "received" ? "From" : "To"} {q.peer} ·{" "}
                        {time(q.createdAt)}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Expand quanta"
                        onClick={() => setExpanded(q)}
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                    {q.text && <p>{q.text}</p>}
                    <div className="quanta-gallery">
                      {(q.attachments ?? []).slice(0, 4).map((a, i) => (
                        <AttachmentTile
                          key={i}
                          q={q}
                          a={a}
                          index={i}
                          notify={notify}
                        />
                      ))}
                    </div>
                    {(q.attachments?.length ?? 0) > 4 && (
                      <button
                        className="text-link"
                        onClick={() => setExpanded(q)}
                      >
                        View all {q.attachments!.length} attachments
                      </button>
                    )}
                    {q.text && (
                      <button
                        className="text-link"
                        onClick={() =>
                          void bridge
                            .copy(q.text)
                            .then(() => setToast("Text copied."))
                            .catch(notify)
                        }
                      >
                        <Copy size={14} /> Copy text
                      </button>
                    )}
                  </article>
                ))}
                {!results.length && (
                  <p className="panel-empty">
                    {search
                      ? "No matching quanta."
                      : "Your quanta will appear here."}
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
        {page === "history" && (
          <section className="history-page">
            <div className="history-tools">
              <div className="segmented">
                {(["received", "sent", "all"] as const).map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "selected" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a thought…"
                  aria-label="Search history"
                />
              </label>
              <button
                className="clear-history"
                aria-label="Clear transfer history"
                disabled={!history.length}
                onClick={() => setConfirm("history")}
              >
                <X size={18} /> Clear history
              </button>
            </div>
            {results.length ? (
              results.map((q) => (
                <article className="history-item" key={q.id}>
                  <span className={`transfer-direction ${q.direction}`}>
                    {q.direction === "sent" ? (
                      <ArrowUpRight size={20} />
                    ) : (
                      <ArrowDownLeft size={20} />
                    )}
                  </span>
                  <div>
                    <div className="transfer-meta">
                      {q.direction === "sent" ? "To" : "From"} {q.peer}{" "}
                      <span>
                        · {new Date(q.createdAt).toLocaleDateString()} ·{" "}
                        {time(q.createdAt)}
                      </span>
                    </div>
                    <p>{q.text}</p>
                    <AttachmentHistory q={q} notify={notify} />
                    <span className={`delivery-status ${q.status}`}>
                      {q.status === "delivered" ? (
                        <CheckCheck size={13} />
                      ) : (
                        <RefreshCw size={13} />
                      )}{" "}
                      {q.status === "delivered"
                        ? "Received"
                        : q.status === "pending"
                          ? "Awaiting receipt"
                          : "Receipt unconfirmed"}
                    </span>
                  </div>
                  <div className="history-item-actions">
                    {q.status === "failed" && q.direction === "sent" && (
                      <button
                        className="icon-button"
                        aria-label="Retry transfer"
                        disabled={busy || !connected}
                        onClick={() => void send(q)}
                      >
                        <RefreshCw size={17} />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label="Copy transfer text"
                      disabled={!q.text}
                      onClick={() =>
                        bridge
                          .copy(q.text)
                          .then(() => setToast("Copied to clipboard."))
                          .catch(notify)
                      }
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-page">
                <History size={36} />
                <h2>
                  {search
                    ? "No matching quanta."
                    : "Your thoughts will leave a trail."}
                </h2>
                <p>
                  {search
                    ? "Try a different word."
                    : "Sent and received text will appear here."}
                </p>
                <button
                  className="soft-button"
                  onClick={() => navigate("send")}
                >
                  Compose your first quanta <ArrowUpRight size={16} />
                </button>
              </div>
            )}
            <p className="page-footnote">
              The latest 200 transfers, stored on this device.
            </p>
          </section>
        )}
        {page === "devices" && (
          <section className="devices-page">
            <form
              className="settings-card device-name-card"
              onSubmit={(e) => {
                e.preventDefault();
                void rename();
              }}
            >
              <label htmlFor="device-name">This desktop’s name</label>
              <div className="name-input-row">
                <input
                  id="device-name"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  maxLength={80}
                />
                <button className="soft-button" disabled={!native}>
                  Save name
                </button>
              </div>
            </form>
            <div className="pairing-card">
              <div className="eyebrow">
                {state?.peerName ? "YOUR LINKED DEVICE" : "OPEN A TUNNEL"}
              </div>
              {state?.peerName ? (
                <>
                  <div className="linked-device">
                    <Link2 size={32} />
                    <h2>{state.peerName}</h2>
                    <p>
                      {connected
                        ? "Connected over your local network."
                        : "Offline. Reconnect on the same Wi-Fi."}
                    </p>
                  </div>
                  <button
                    className="soft-button"
                    onClick={() => setConfirm("unpair")}
                  >
                    <Unplug size={17} /> Unlink device
                  </button>
                </>
              ) : (
                <>
                  <h2>Scan. Link. Tunnel.</h2>
                  <p>Open Tunnel on Android and scan this code.</p>
                  {pair && pair.expires > clock ? (
                    <div className="qr-wrap">
                      <QRCodeSVG
                        value={JSON.stringify(pair)}
                        size={220}
                        level="M"
                        marginSize={2}
                      />
                      <span>
                        Expires in{" "}
                        {Math.max(0, Math.ceil((pair.expires - clock) / 1000))}s
                      </span>
                      <button
                        className="soft-button"
                        onClick={() =>
                          bridge
                            .copy(JSON.stringify(pair))
                            .then(() => setToast("Pairing code copied."))
                            .catch(notify)
                        }
                      >
                        <Copy size={15} /> Copy pairing code
                      </button>
                    </div>
                  ) : (
                    <div className="qr-placeholder">
                      <Link2 size={44} />
                      <p>
                        {pair
                          ? "Code expired. Make a fresh one."
                          : native
                            ? "Your private passage starts here."
                            : "QR pairing is available in the desktop app."}
                      </p>
                    </div>
                  )}
                  {state?.addresses.length ? (
                    <label className="address-selector">
                      Local network address
                      <select
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          setPair(null);
                        }}
                      >
                        {state.addresses.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    className="soft-button"
                    onClick={() => void createPair()}
                    disabled={pairBusy || !native || !address}
                  >
                    <RefreshCw size={16} />{" "}
                    {pairBusy
                      ? "Creating code…"
                      : pair
                        ? "Refresh pairing code"
                        : "Create pairing code"}
                  </button>
                </>
              )}
            </div>
            <div className="pairing-guide">
              <h3>
                A little setup.
                <br />A lot less friction.
              </h3>
              {[
                "Keep both devices on the same Wi-Fi.",
                "On your phone, open Linked devices.",
                "Scan the QR and your tunnel is ready.",
              ].map((s, i) => (
                <div className="guide-step" key={s}>
                  <span>0{i + 1}</span>
                  <p>{s}</p>
                </div>
              ))}
              <div className="quiet-note">
                <ShieldCheck size={20} />
                <p>
                  The QR contains your pairing secret.
                  <br />
                  Only share it with your own device.
                </p>
              </div>
            </div>
          </section>
        )}
        {page === "settings" && (
          <section className="settings-page">
            <div className="settings-card">
              <div className="eyebrow">
                <Sparkles size={15} /> AURORA THEMES
              </div>
              <h2>A softer kind of space.</h2>
              <p>Change the atmosphere. Keep your train of thought.</p>
              <div className="theme-grid">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-option ${aurora.selection.themeId === t.id ? "selected" : ""}`}
                    onClick={() => selectTheme({ themeId: t.id })}
                  >
                    <span
                      className="theme-swatch"
                      style={{
                        background: t.variants.get("light")!.tokens.surface.hex,
                      }}
                    >
                      <i
                        style={{
                          background:
                            t.variants.get("light")!.tokens.primary.hex,
                        }}
                      />
                      <i
                        style={{
                          background:
                            t.variants.get("light")!.tokens.primaryContainer
                              .hex,
                        }}
                      />
                    </span>
                    <span>
                      {t.name}
                      {aurora.selection.themeId === t.id && <Check size={16} />}
                    </span>
                  </button>
                ))}
              </div>
              <div className="setting-row">
                <div>
                  <h4>Appearance</h4>
                  <p>Start soft. Follow your rhythm.</p>
                </div>
                <select
                  aria-label="Appearance"
                  value={aurora.selection.appearance}
                  onChange={(e) =>
                    selectTheme({
                      appearance: e.target
                        .value as ThemePreferences["appearance"],
                    })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
            <div className="settings-card">
              <div className="eyebrow">THE LITTLE DETAILS</div>
              {(
                [
                  {
                    key: "autoCopy",
                    label: "Copy incoming text or images automatically",
                    hint: "Ready to paste as soon as it arrives.",
                  },
                  {
                    key: "notifications",
                    label: "Notify when quanta arrives",
                    hint: "Click the notification to open transfer history.",
                  },
                  {
                    key: "startup",
                    label: "Start Tunnel with Windows",
                    hint: "A quiet presence in your system tray.",
                  },
                ] as const
              ).map((s) => (
                <div className="setting-row" key={s.key}>
                  <div>
                    <h4>{s.label}</h4>
                    <p>{s.hint}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={state?.[s.key] ?? false}
                    aria-label={s.label}
                    className={`toggle ${state?.[s.key] ? "enabled" : ""}`}
                    disabled={!native}
                    onClick={() =>
                      void updatePreferences({ [s.key]: !state?.[s.key] })
                    }
                  >
                    <i />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {state?.error && (
          <p className="error-banner" role="alert">
            {state.error}
          </p>
        )}
      </main>
      <footer className="app-footer">
        <span>
          <span className="status-dot" />
          {native
            ? "LOCAL FIRST. ALWAYS CLOSE."
            : "BROWSER PREVIEW · Native transfers require the desktop app."}
        </span>
        <span>
          TUNNEL <span className="version">V.01</span>
        </span>
      </footer>
      {arrival > 0 && (
        <div key={arrival} className="arrival-pulse" aria-hidden="true">
          <i />
          <i />
          <i />
          <span>
            <ArrowDownLeft size={20} />
            Quanta received
          </span>
        </div>
      )}
      {expanded && (
        <div className="modal-backdrop" onClick={() => setExpanded(null)}>
          <section
            className="quanta-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Full quanta"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>Quanta from {expanded.peer}</h2>
              <button
                className="icon-button"
                autoFocus
                aria-label="Close quanta"
                onClick={() => setExpanded(null)}
              >
                <X />
              </button>
            </header>
            <p className="full-quanta-text">{expanded.text}</p>
            {expanded.text && (
              <button
                className="soft-button"
                onClick={() => void bridge.copy(expanded.text).catch(notify)}
              >
                <Copy size={16} /> Copy text
              </button>
            )}
            <AttachmentHistory q={expanded} notify={notify} />
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {confirm && (
        <div className="modal-scrim">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">
              {confirm === "unpair"
                ? "Close this tunnel?"
                : "Clear your trail?"}
            </h2>
            <p>
              {confirm === "unpair"
                ? "Your phone will need a new QR code to reconnect."
                : "This removes transfer history from this desktop."}
            </p>
            <div>
              <button className="soft-button" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                className="soft-button"
                onClick={async () => {
                  try {
                    await (confirm === "unpair"
                      ? bridge.unpair()
                      : bridge.clearHistory());
                    setPair(null);
                    setConfirm(null);
                    await refresh();
                  } catch (e) {
                    notify(e);
                  }
                }}
              >
                {confirm === "unpair" ? "Unlink" : "Clear history"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
