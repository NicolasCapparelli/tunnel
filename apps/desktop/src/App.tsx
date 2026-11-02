import axisMark from "../../../assets/tunnel.svg";
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
  ArrowLeft,
  ChevronLeft,
  ArrowUp,
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
import { quantaSlot } from "./layout";
import { bridge, native, type Snapshot } from "./bridge";
import SingularityPanel from "./SingularityPanel";
import {
  composerPrompts,
  nextPrompt,
  validDeviceName,
} from "@tunnel/shared/composer";
type Page = "send" | "history" | "devices" | "singularity" | "settings";
const pages = [
  { id: "send", label: "Tunnel", icon: ArrowUp },
  { id: "history", label: "History", icon: History },
  { id: "singularity", label: "Singularity", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className={`brand-mark ${small ? "small" : ""}`}
      src={axisMark}
      alt=""
      aria-hidden="true"
    />
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
  noActions = false,
}: {
  noActions?: boolean;
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
      {q && !noActions && (
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
function saveAllPhotos(q: Transfer, notify: (e: unknown) => void) {
  void (async () => {
    for (const [index, a] of (q.attachments ?? []).entries())
      if (a.mimeType.startsWith("image/"))
        await bridge.saveAttachment(q.id, index);
  })().catch(notify);
}
function AttachmentHistory({
  q,
  notify,
  onView,
  inlineDownload = true,
}: {
  onView: (q: Transfer, index: number) => void;
  q: Transfer;
  notify: (e: unknown) => void;
  // Grid cards put download-all with their other actions instead.
  inlineDownload?: boolean;
}) {
  const photos = (q.attachments ?? [])
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.mimeType.startsWith("image/"));
  return (
    <div className="history-attachments">
      {photos.length > 0 && (
        <div className="history-photo-row">
          <button
            className="photo-stack mini"
            aria-label={`Open ${photos.length} photos`}
            onClick={() => onView(q, photos[0].index)}
          >
            {photos.slice(0, 3).map(({ a, index }, i) => (
              <span
                className="photo-print"
                key={index}
                style={{ "--print-index": i } as React.CSSProperties}
              >
                <AttachmentTile
                  q={q}
                  a={a}
                  index={index}
                  notify={notify}
                  noActions
                />
                {i === Math.min(photos.length, 3) - 1 && (
                  <b className="photo-count">{photos.length}</b>
                )}
              </span>
            ))}
          </button>
          {inlineDownload && photos.length > 1 && (
            <button
              className="icon-button"
              aria-label="Download all photos"
              onClick={() => saveAllPhotos(q, notify)}
            >
              <Download size={18} />
            </button>
          )}
        </div>
      )}
      {(q.attachments ?? []).map(
        (a, i) =>
          !a.mimeType.startsWith("image/") && (
            <AttachmentTile key={i} q={q} a={a} index={i} notify={notify} />
          ),
      )}
    </div>
  );
}
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const singleImage = (q: Transfer) =>
  q.attachments?.length === 1 && q.attachments[0].mimeType.startsWith("image/");
const statusLabel = (q: Transfer) =>
  (q.direction === "sent" ? "Sent" : "Received") +
  " · " +
  (q.status === "delivered"
    ? "Received"
    : q.status === "pending"
      ? "Awaiting receipt"
      : "Receipt unconfirmed");
// Fit a photo of the given size inside the window, leaving room for the band.
function fitPhoto(w: number, h: number) {
  const maxW = Math.min(window.innerWidth * 0.92 - 16, 1800);
  const maxH = window.innerHeight * 0.9 - 56;
  const scale = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
// Full-size viewer sources, shared across opens so a revisited photo shows at once.
const viewerSources = new Map<string, Promise<string>>();
const viewerReady = new Map<string, { src: string; w: number; h: number }>();
function viewerSource(q: Transfer, index: number) {
  const a = q.attachments?.[index];
  if (!a) return Promise.reject(new Error("Photo not found"));
  if (a.data)
    return Promise.resolve("data:" + a.mimeType + ";base64," + a.data);
  const key = q.id + "/" + index;
  let source = viewerSources.get(key);
  if (!source) {
    source = bridge
      .previewAttachment(q.id, index, true)
      .catch(() => bridge.previewAttachment(q.id, index));
    source.catch(() => viewerSources.delete(key));
    viewerSources.set(key, source);
    if (viewerSources.size > 16) {
      const oldest = viewerSources.keys().next().value!;
      viewerSources.delete(oldest);
      viewerReady.delete(oldest);
    }
  }
  return source;
}
function ViewerImage({ q, index }: { q: Transfer; index: number }) {
  const a = q.attachments![index];
  const key = q.id + "/" + index;
  const ready = viewerReady.get(key);
  const [src, setSrc] = useState<string | undefined>(ready?.src);
  const [natural, setNatural] = useState<{ w: number; h: number } | undefined>(
    ready,
  );
  const [failed, setFailed] = useState(false);
  const [, setViewport] = useState(0);
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth + window.innerHeight);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const cached = viewerReady.get(key);
    setSrc(cached?.src);
    setNatural(cached);
    setFailed(false);
    if (cached) return;
    let live = true;
    viewerSource(q, index)
      .then((url) => live && setSrc(url))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [key]);
  const size = natural ? fitPhoto(natural.w, natural.h) : undefined;
  return (
    <div className={"viewer-image" + (size ? "" : " loading")} style={size}>
      {failed && (
        <p className="viewer-failed">This photo could not be loaded.</p>
      )}
      {src && (
        <img
          src={src}
          alt={a.name}
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            const loaded = {
              src,
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            };
            viewerReady.set(key, loaded);
            setNatural(loaded);
          }}
        />
      )}
    </div>
  );
}
function PhotoViewer({
  q,
  index,
  onClose,
  onChange,
  onCopied,
  notify,
}: {
  q: Transfer;
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
  onCopied: () => void;
  notify: (e: unknown) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [direction, setDirection] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const photos = (q.attachments ?? [])
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.mimeType.startsWith("image/"));
  const position = photos.findIndex((p) => p.i === index);
  const close = () => {
    if (leaving) return;
    if (reducedMotion()) return onClose();
    setLeaving(true);
    setTimeout(onClose, 200);
  };
  const turn = (delta: number) => {
    const next = photos[position + delta];
    if (!next) return;
    setDirection(delta);
    onChange(next.i);
  };
  const copy = () =>
    void bridge.copyAttachment(q.id, index).then(onCopied).catch(notify);
  useEffect(() => {
    dialog.current?.focus();
  }, []);
  // Warm the neighbors so the arrows switch without a wait.
  useEffect(() => {
    for (const p of [photos[position - 1], photos[position + 1]])
      if (p) void viewerSource(q, p.i).catch(() => {});
  }, [q.id, index]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") turn(-1);
      if (e.key === "ArrowRight") turn(1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, q.id, leaving]);
  if (!q.attachments?.[index]) return null;
  const many = photos.length > 1;
  return (
    <div
      className={"modal-scrim photo-viewer" + (leaving ? " leaving" : "")}
      onClick={close}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        className="viewer-print"
        role="dialog"
        aria-modal="true"
        aria-label="Photo viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          key={index}
          className="viewer-slide"
          style={
            { "--slide-from": `${direction * 18}px` } as React.CSSProperties
          }
        >
          <ViewerImage q={q} index={index} />
        </div>
        <div className="viewer-band">
          <small>{many ? `${position + 1}/${photos.length}` : ""}</small>
          <div className="viewer-arrows">
            {many && (
              <>
                <button
                  className="icon-button"
                  aria-label="Previous photo"
                  disabled={position <= 0}
                  onClick={() => turn(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next photo"
                  disabled={position >= photos.length - 1}
                  onClick={() => turn(1)}
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
          <button
            className="icon-button viewer-copy"
            aria-label="Copy this photo"
            onClick={copy}
          >
            <Copy size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("tunnel-sidebar-collapsed") === "true",
  );
  const [settingsPage, setSettingsPage] = useState<
    "" | "look" | "arrival" | "account"
  >("");
  const [fanned, setFanned] = useState(false);
  const [photo, setPhoto] = useState<{ q: Transfer; index: number } | null>(
    null,
  );
  const [sheen, setSheen] = useState(0);
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
  const [flash, setFlashState] = useState<{ text: string; n: number }>();
  const setFlash = (text: string) =>
    setFlashState((old) => ({ text, n: (old?.n ?? 0) + 1 }));
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
    if (!flash) return;
    const t = setTimeout(() => setFlashState(undefined), 1400);
    return () => clearTimeout(t);
  }, [flash]);
  const copyQuanta = (q: Transfer) =>
    void (
      q.text
        ? bridge.copy(q.text).then(() => setFlash("Copied"))
        : bridge.copyAttachment(q.id, 0).then(() => setFlash("Photo copied"))
    ).catch(notify);
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
    setSheen((v) => v + 1);
    try {
      await Promise.all([
        bridge.send(draft, retry?.id ?? crypto.randomUUID(), files),
        new Promise((resolve) => setTimeout(resolve, 1100)),
      ]);
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
    if (page === "send" && !expanded && !photo) void send();
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
    if (p === "settings") setSettingsPage("");
    if (p === "send") setSheen((v) => v + 1);
    setPage(p);
  };
  return (
    <div
      className={`app-shell dusk-shell ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <aside className="desktop-sidebar">
        <button
          className="side-brand"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() =>
            setCollapsed((v) => {
              localStorage.setItem("tunnel-sidebar-collapsed", String(!v));
              return !v;
            })
          }
        >
          <BrandMark small />
          <b>Tunnel</b>
        </button>
        <nav aria-label="Main navigation">
          {pages.map((p) => (
            <button
              key={p.id}
              title={p.label}
              aria-label={p.label}
              className={
                page === p.id || (p.id === "settings" && page === "devices")
                  ? "selected"
                  : ""
              }
              onClick={() => navigate(p.id)}
              aria-current={page === p.id ? "page" : undefined}
            >
              <p.icon size={19} />
              <span>{p.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className={`status-dot ${connected ? "is-online" : ""}`} />
          <span>
            {state?.peerName
              ? `${state.peerName} · ${connected ? "Connected" : "Offline"}`
              : native
                ? "Local first"
                : "Browser preview"}
          </span>
        </div>
      </aside>
      <main
        className={`workspace ${page === "send" ? "workspace-send" : ""} ${page === "singularity" ? "workspace-singularity" : ""} ${page === "history" ? "workspace-history" : ""} ${page === "settings" || page === "devices" ? "workspace-settings" : ""}`}
      >
        {page !== "send" && (
          <div className="page-heading">
            {(page === "devices" || (page === "settings" && settingsPage)) && (
              <button
                className="icon-button"
                aria-label="Back"
                onClick={() => {
                  setPage("settings");
                  setSettingsPage("");
                }}
              >
                <ArrowLeft size={21} />
              </button>
            )}
            <div>
              <h1>
                {page === "singularity"
                  ? "Singularity"
                  : page === "history"
                    ? "History"
                    : page === "devices"
                      ? "Linked devices"
                      : settingsPage === "look"
                        ? "Appearance"
                        : settingsPage === "arrival"
                          ? "When something arrives"
                          : settingsPage === "account"
                            ? "Account"
                            : "Settings"}
              </h1>
              <p>
                {page === "singularity"
                  ? "Saved on every device you sign in to. Not sent to a linked device."
                  : page === "history"
                    ? "All quanta you've tunneled"
                    : page === "devices"
                      ? "Link your phone over the local network."
                      : settingsPage === "account"
                        ? "Your shared quanta, on every device."
                        : ""}
              </p>
            </div>
          </div>
        )}
        <SingularityPanel
          view={
            page === "singularity"
              ? "quanta"
              : page === "settings" && settingsPage === "account"
                ? "account"
                : "hidden"
          }
          onOpenAccount={() => {
            setPage("settings");
            setSettingsPage("account");
          }}
        />
        {page === "send" && (
          <div className="send-layout">
            <section className="composer-area" aria-label="Compose quanta">
              <div key={sheen} className="dusk-dotfield" aria-hidden="true">
                <i />
              </div>
              <div className="to-line">
                To <strong>{state?.peerName ?? "your phone"}</strong>
                <button
                  className={`connection-pill ${connected ? "online" : ""}`}
                  onClick={() => navigate("devices")}
                >
                  <span className="status-dot" />
                  {connected
                    ? "Linked"
                    : state?.peerName
                      ? "Offline"
                      : "Link a device"}
                </button>
              </div>
              <div className="composer-row">
                <div className={`quanta-card ${busy ? "tunneling" : ""}`}>
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
                        <BrandMark />
                        <h2>{composerPrompts[prompt]}</h2>
                        <p>Tap here and let a thought in.</p>
                      </div>
                    )}
                  </div>
                  {!!attachments.length && (
                    <div className="composer-attachments">
                      <button
                        className={`photo-stack composer-stack ${fanned ? "fanned" : ""} ${
                          !text.trim() &&
                          attachments.every((a) =>
                            a.mimeType.startsWith("image/"),
                          )
                            ? "large"
                            : ""
                        }`}
                        hidden={
                          !attachments.some((a) =>
                            a.mimeType.startsWith("image/"),
                          )
                        }
                        aria-label="Spread photo prints"
                        aria-expanded={fanned}
                        onClick={() => setFanned((v) => !v)}
                      >
                        {attachments
                          .map((a, i) => ({ a, i }))
                          .filter(({ a }) => a.mimeType.startsWith("image/"))
                          .slice(0, 3)
                          .map(({ a, i }, n, prints) => (
                            <span
                              className="photo-print"
                              key={i}
                              style={
                                { "--print-index": n } as React.CSSProperties
                              }
                            >
                              <AttachmentTile a={a} index={i} notify={notify} />
                              {n === prints.length - 1 && (
                                <b className="photo-count">
                                  {
                                    attachments.filter((a) =>
                                      a.mimeType.startsWith("image/"),
                                    ).length
                                  }
                                </b>
                              )}
                            </span>
                          ))}
                      </button>
                      <div className="draft-file-list">
                        {attachments.map((a, i) => (
                          <div className="draft-file" key={a.uri ?? i}>
                            <Paperclip size={14} />
                            <span title={a.name}>{a.name}</span>
                            <button
                              className="icon-button"
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
                <h2>Recent</h2>
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
                  <article className="recent-quanta" key={q.id}>
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
                    <AttachmentHistory
                      q={q}
                      notify={notify}
                      onView={(q, index) => setPhoto({ q, index })}
                    />
                    {q.status === "failed" && q.direction === "sent" && (
                      <button
                        className="icon-button recent-copy"
                        aria-label="Retry transfer"
                        disabled={busy || !connected}
                        onClick={() => void send(q)}
                      >
                        <RefreshCw size={17} />
                      </button>
                    )}
                    {(!!q.text || singleImage(q)) && (
                      <button
                        className="icon-button recent-copy"
                        aria-label={q.text ? "Copy quanta" : "Copy photo"}
                        onClick={() => copyQuanta(q)}
                      >
                        <Copy size={16} />
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
            <div className="history-scroll">
              {results.length ? (
                <div className="quanta-grid">
                  {results.map((q) => (
                    <article
                      className={"history-item " + quantaSlot(q.text)}
                      key={q.id}
                    >
                      <div>
                        <div className="transfer-meta">
                          {q.direction === "sent" ? "To" : "From"} {q.peer}{" "}
                          <span>
                            · {new Date(q.createdAt).toLocaleDateString()} ·{" "}
                            {time(q.createdAt)}
                          </span>
                        </div>
                        <p>{q.text}</p>
                        <AttachmentHistory
                          q={q}
                          notify={notify}
                          onView={(q, index) => setPhoto({ q, index })}
                          inlineDownload={false}
                        />
                      </div>
                      <span
                        className={`delivery-status ${q.status} ${q.direction}`}
                        role="img"
                        aria-label={statusLabel(q)}
                        title={statusLabel(q)}
                      >
                        <i className="status-dot" />
                        {q.direction === "sent" ? (
                          <ArrowUpRight size={14} />
                        ) : (
                          <ArrowDownLeft size={14} />
                        )}
                      </span>
                      <div className="history-item-actions">
                        <button
                          className="icon-button"
                          aria-label="Expand quanta"
                          onClick={() => setExpanded(q)}
                        >
                          <Maximize2 size={17} />
                        </button>
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
                        {(q.attachments ?? []).filter((a) =>
                          a.mimeType.startsWith("image/"),
                        ).length > 1 && (
                          <button
                            className="icon-button"
                            aria-label="Download all photos"
                            onClick={() => saveAllPhotos(q, notify)}
                          >
                            <Download size={17} />
                          </button>
                        )}
                        {(!!q.text || singleImage(q)) && (
                          <button
                            className="icon-button"
                            aria-label={q.text ? "Copy quanta" : "Copy photo"}
                            onClick={() => copyQuanta(q)}
                          >
                            <Copy size={18} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
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
            </div>
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
              <h3>Quick setup</h3>
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
        {page === "settings" && !settingsPage && (
          <section className="settings-list">
            {[
              {
                id: "look",
                title: "Appearance",
                hint: `${themes.find((t) => t.id === aurora.selection.themeId)?.name ?? "Theme"} · ${aurora.selection.appearance}`,
              },
              {
                id: "arrival",
                title: "When something arrives",
                hint: "Clipboard, notifications and startup",
              },
              {
                id: "devices",
                title: "Linked devices",
                hint: state?.peerName ?? "Link a phone",
              },
              {
                id: "account",
                title: "Account",
                hint: "Cloudflare sign-in and sync",
              },
            ].map((s) => (
              <button
                className="settings-list-row"
                key={s.id}
                onClick={() =>
                  s.id === "devices"
                    ? setPage("devices")
                    : setSettingsPage(s.id as "look" | "arrival" | "account")
                }
              >
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.hint}</small>
                </span>
                <ChevronRight size={20} />
              </button>
            ))}
          </section>
        )}
        {page === "settings" &&
          (settingsPage === "look" || settingsPage === "arrival") && (
            <section className="settings-page">
              <div className="settings-card" hidden={settingsPage !== "look"}>
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
                          background:
                            t.variants.get("light")!.tokens.surface.hex,
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
                        {aurora.selection.themeId === t.id && (
                          <Check size={16} />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="segmented appearance-control"
                  aria-label="Appearance"
                >
                  {(["light", "dark", "system"] as const).map((a) => (
                    <button
                      key={a}
                      className={
                        aurora.selection.appearance === a ? "selected" : ""
                      }
                      onClick={() => selectTheme({ appearance: a })}
                    >
                      {a[0].toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="settings-card"
                hidden={settingsPage !== "arrival"}
              >
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
        <div className="modal-scrim" onClick={() => setExpanded(null)}>
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
            <AttachmentHistory
              q={expanded}
              notify={notify}
              onView={(q, index) => setPhoto({ q, index })}
            />
          </section>
        </div>
      )}
      {photo && (
        <PhotoViewer
          q={photo.q}
          index={photo.index}
          onClose={() => setPhoto(null)}
          onChange={(index) => setPhoto({ ...photo, index })}
          onCopied={() => setFlash("Photo copied")}
          notify={notify}
        />
      )}
      {flash && (
        <div key={flash.n} className="toast quick" role="status">
          {flash.text}
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
