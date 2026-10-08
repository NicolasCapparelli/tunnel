import { useCallback, useEffect, useRef, useState } from "react";
import { useAuroraController, useAuroraState } from "@aurora/react";
import {
  themes,
  themeSelection,
  type ThemePreferences,
} from "@tunnel/shared/theme";
import { validateText, type Pairing, type Transfer } from "@tunnel/shared";
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
  Menu,
  Paperclip,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  X,
} from "lucide-react";
import { bridge, native, type Snapshot } from "./bridge";
import SendRail from "./SendRail";

type Page = "send" | "history" | "devices" | "settings";
const pages = [
  { id: "send", label: "New quanta", icon: Plus },
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

export default function App() {
  const [page, setPage] = useState<Page>("send");
  const [menu, setMenu] = useState(false);
  const [text, setText] = useState(
    () => localStorage.getItem("tunnel-draft") ?? "",
  );
  const [state, setState] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [pair, setPair] = useState<Pairing | null>(null);
  const [address, setAddress] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<"unpair" | "history" | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
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
  const notify = (e: unknown) =>
    setToast(e instanceof Error ? e.message : String(e));
  const send = async (retry?: Transfer) => {
    if (busy) return;
    const draft = retry?.text ?? text;
    try {
      validateText(draft);
    } catch (e) {
      notify(e);
      return;
    }
    if (!state?.connected) {
      setToast("Link your phone and keep Tunnel open on both devices.");
      return;
    }
    setBusy(true);
    try {
      await bridge.send(draft, retry?.id ?? crypto.randomUUID());
      if (!retry) setText((t) => (t === draft ? "" : t));
      setToast("Quanta received on " + state.peerName + ".");
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
      await refresh();
    }
  };
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
      q.text.toLowerCase().includes(search.toLowerCase()),
  );
  const navigate = (p: Page) => {
    setPage(p);
    setMenu(false);
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <button
            className="icon-button menu-toggle"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
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
          <span className="header-divider" />
          <span className="header-caption">A LITTLE CLOSER.</span>
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
        {menu && (
          <>
            <button
              className="menu-backdrop"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            />
            <nav className="nav-menu" aria-label="Main navigation">
              {pages.map((p) => (
                <button
                  key={p.id}
                  className={page === p.id ? "selected" : ""}
                  onClick={() => navigate(p.id)}
                >
                  <p.icon size={18} />
                  {p.label}
                  {page === p.id && <Check size={15} />}
                </button>
              ))}
            </nav>
          </>
        )}
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR PERSONAL SHORTCUT THROUGH SPACE</div>
            <h1>
              {page === "send" ? (
                <>
                  Context, in <em>motion.</em>
                </>
              ) : page === "history" ? (
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
              {page === "send"
                ? "A thought, a link, a little context. Right where you need it."
                : page === "history"
                  ? "Everything you’ve sent and received, in one quiet place."
                  : page === "devices"
                    ? "One scan. Two devices. A much shorter distance."
                    : "Powered by Aurora. Tuned to your comfort."}
            </p>
          </div>
          <span className="page-index">
            0{pages.findIndex((p) => p.id === page) + 1} / 04
          </span>
        </div>
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
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      spellCheck
                      placeholder=" "
                    />
                    {!text && (
                      <div className="empty-quanta">
                        <Orbit />
                        <h2>
                          Ready to appear
                          <br />
                          somewhere else?
                        </h2>
                        <p>Tap here and let a thought in.</p>
                      </div>
                    )}
                  </div>
                  <div className="card-footer">
                    <span>
                      {text
                        ? `${text.length.toLocaleString()} characters`
                        : "A blank space. A small possibility."}
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
                <SendRail
                  ready={!!text.trim() && connected}
                  busy={busy}
                  onSend={() => void send()}
                />
              </div>
              <div className="composer-actions">
                <button
                  className="attachment-button"
                  onClick={() =>
                    setToast(
                      "Attachments are next. This first tunnel carries text.",
                    )
                  }
                >
                  <Paperclip size={22} />
                  <span>Attach something</span>
                  <span className="soon-tag">SOON</span>
                </button>
                <button onClick={() => void paste()}>
                  <Clipboard size={22} />
                  <span>Paste from clipboard</span>
                  <span className="keycap">↙</span>
                </button>
              </div>
              <p className="composer-hint">
                <ArrowUpRight size={14} /> Slide the particle up to send. Keep
                your thought moving.
              </p>
            </section>
            <aside className="side-panel">
              <div className="destination-card">
                <div className="eyebrow">THE OTHER SIDE</div>
                <div className="device-illustration" aria-hidden="true">
                  <div className="device-outline">
                    <div />
                    <span />
                  </div>
                  <div className="device-ripple" />
                </div>
                <h3>{state?.peerName ?? "Your phone, closer."}</h3>
                <p>
                  {connected
                    ? "Linked and ready to receive."
                    : state?.peerName
                      ? "Open Tunnel on your phone to reconnect."
                      : "Link your phone to open your first tunnel."}
                </p>
                {connected ? (
                  <div className="connected-label">
                    <Radio size={14} /> Same network. Instant connection.
                  </div>
                ) : (
                  <button
                    className="text-link"
                    onClick={() => navigate("devices")}
                  >
                    Link a device <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
              <div className="quiet-note">
                <ShieldCheck size={19} />
                <div>
                  <h4>A private little passage.</h4>
                  <p>
                    Direct across your local network.
                    <br />
                    Encrypted between your devices.
                  </p>
                </div>
              </div>
              {history[0] && (
                <button
                  className="latest-transfer"
                  onClick={() => navigate("history")}
                >
                  <span className="eyebrow">
                    LAST QUANTA · {time(history[0].createdAt)}
                  </span>
                  <p>{history[0].text}</p>
                  <span>
                    View history <ChevronRight size={14} />
                  </span>
                </button>
              )}
              <div className="science-note">
                <span>⌁</span>
                <p>
                  Some things don’t need
                  <br />
                  to take the long way around.
                </p>
              </div>
            </aside>
          </div>
        )}
        {page === "history" && (
          <section className="history-page">
            <div className="history-tools">
              <div className="segmented">
                {(["all", "sent", "received"] as const).map((f) => (
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
                className="icon-button"
                aria-label="Clear transfer history"
                disabled={!history.length}
                onClick={() => setConfirm("history")}
              >
                <X size={18} />
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
                    label: "Copy incoming text automatically",
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
