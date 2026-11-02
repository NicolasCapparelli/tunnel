import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Alert,
  Animated,
  Easing,
  AppState,
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Dimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AuroraSelection } from "@aurora/core";
import {
  nativeColor,
  useAuroraController,
  useAuroraState,
  useAuroraTokens,
} from "@aurora/react-native";
import { themes, type ThemePreferences } from "@tunnel/shared/theme";
import {
  MAX_HISTORY,
  parsePairing,
  validateQuanta,
  validateAttachments,
  type Attachment,
  type ConnectionStatus,
  type Credentials,
  type Quanta,
  type SocketLike,
  type Transfer,
} from "@tunnel/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useShareIntentContext } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as SystemUI from "expo-system-ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clipboard as ClipboardIcon,
  Copy,
  History,
  Link2,
  Menu,
  ArrowLeft,
  ChevronRight,
  Download,
  Share2,
  Maximize2,
  Paperclip,
  Plus,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  X,
} from "lucide-react-native";
import SendRail from "./SendRail";
import { compactQuanta, pairRows } from "./layout";
import {
  DotField,
  FadeList,
  FadeScroll,
  PhotoStack,
  PhotoViewer,
  copyPhoto,
  quickToast,
} from "./DuskPrimitives";
import SingularityPanel from "./SingularityPanel";
import {
  composerPrompts,
  nextPrompt,
  validDeviceName,
} from "@tunnel/shared/composer";
import {
  createConnection,
  getShareSettings,
  setShareSettings,
  setNativeDestinations,
  takeReviewDestination,
  type ShareSettings,
} from "./connection";
import * as DocumentPicker from "expo-document-picker";
import {
  importFile,
  storeQuanta,
  wireQuanta,
  shareFile,
  saveFile,
  releaseFiles,
} from "./files";
import { saveDesktops, saveLocal, type BootState } from "./storage";

import {
  upsertDesktop,
  destinationIds,
  recipientTransfers,
} from "@tunnel/shared/devices";
const singleImage = (q: Transfer) =>
  q.attachments?.length === 1 && q.attachments[0].mimeType.startsWith("image/");

type Page = "send" | "history" | "devices" | "singularity" | "settings";
const navigation = [
  { id: "send", label: "Tunnel", icon: Plus },
  { id: "history", label: "History", icon: History },
  { id: "singularity", label: "Singularity", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require("../../desktop/src-tauri/icons/icon.png")}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export default function TunnelApp({ boot }: { boot: BootState }) {
  const tokens = useAuroraTokens();
  const controller = useAuroraController();
  const aurora = useAuroraState();
  const insets = useSafeAreaInsets();
  const c = {
    surface: nativeColor(tokens.surface),
    paper: nativeColor(tokens.surfaceContainerHigh),
    deep: nativeColor(tokens.surfaceContainerLow),
    inset: nativeColor(tokens.surfaceContainerHighest),
    ink: nativeColor(tokens.onSurface),
    muted: nativeColor(tokens.onSurfaceVariant),
    primary: nativeColor(tokens.primary),
    onPrimary: nativeColor(tokens.onPrimary),
    tint: nativeColor(tokens.primaryContainer),
    tintInk: nativeColor(tokens.onPrimaryContainer),
    line: nativeColor(tokens.outlineVariant),
    error: nativeColor(tokens.error),
  };
  const [sendLayout, setSendLayout] = useState(boot.sendLayout);
  const [underControl, setUnderControl] = useState(boot.underControl);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [expanded, setExpanded] = useState<Transfer | null>(null);
  const [settingsPage, setSettingsPage] = useState<
    "" | "appearance" | "share" | "account"
  >("");
  const [sheen, setSheen] = useState(0);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const viewport = useWindowDimensions();
  const arrivalOpacity = useRef(new Animated.Value(0)).current;
  const arrivalScale = useRef(new Animated.Value(0.2)).current;
  const [page, setPage] = useState<Page>("send");
  const pageStack = useRef<Page[]>(["send"]);
  const [prompt, setPrompt] = useState(0);
  const [deviceName, setDeviceName] = useState(boot.deviceName);
  const [nameDraft, setNameDraft] = useState(boot.deviceName);
  const previousAppState = useRef(AppState.currentState);
  const [menu, setMenu] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(
    boot.attachments,
  );
  const [shareSettings, updateShareSettings] = useState(getShareSettings);
  const [draft, setDraft] = useState(boot.draft);
  const [history, setHistory] = useState(boot.history);
  const [links, setLinks] = useState<Credentials[]>(boot.links);
  const linksRef = useRef(links);
  linksRef.current = links;
  const [destinations, setDestinations] = useState<string[]>(boot.destinations);
  const destinationsRef = useRef(destinations);
  destinationsRef.current = destinations;
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>(
    {},
  );
  const credentials =
    links.find((c) => destinations.includes(c.serverId)) ?? links[0] ?? null;
  const status: ConnectionStatus = destinations.some(
    (id) => statuses[id] === "connected",
  )
    ? "connected"
    : destinations.some((id) => statuses[id] === "connecting")
      ? "connecting"
      : "offline";
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [autoCopy, setAutoCopy] = useState(boot.autoCopy);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">("received");
  const input = useRef<TextInput>(null);
  const clients = useRef(
    new Map<string, ReturnType<typeof createConnection>>(),
  );
  const historyRef = useRef(boot.history);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const seen = useRef(boot.seen);
  const historyQueue = useRef(Promise.resolve());
  const copyIncoming = useRef(autoCopy);
  copyIncoming.current = autoCopy;
  const scanLocked = useRef(false);
  const sending = useRef(false);
  const motion = useRef(new Animated.Value(0)).current;
  // Eases the next empty composer in after a send, so the swap is not a jump.
  const entry = useRef(new Animated.Value(1)).current;
  // Built once: rebuilding native-driven nodes on every render stalls touches.
  const composerMotion = useRef({
    opacity: Animated.multiply(
      motion.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      entry,
    ),
    translateY: Animated.add(
      motion.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }),
      entry.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
    ),
    scale: entry.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
  }).current;
  const reduced = useRef(false);
  const {
    hasShareIntent,
    shareIntent,
    resetShareIntent,
    error: shareError,
  } = useShareIntentContext();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.surface);
  }, [c.surface]);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduced.current = v;
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => {
        reduced.current = v;
      },
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        void saveLocal("tunnel-draft", draft).catch(() =>
          setToast("Could not save your draft."),
        ),
      200,
    );
    return () => clearTimeout(timeout);
  }, [draft]);
  useEffect(() => {
    void saveLocal("tunnel-attachments", attachments).catch(() =>
      setToast("Could not save attachments."),
    );
  }, [attachments]);
  useEffect(() => {
    if (!hasShareIntent) return;
    const target = takeReviewDestination();
    if (target && linksRef.current.some((peer) => peer.serverId === target)) {
      destinationsRef.current = [target];
      setDestinations([target]);
      void saveLocal("tunnel-destinations", [target])
        .then(() => setNativeDestinations([target]))
        .catch(() => setToast("Could not save destination."));
    }
    const text = shareIntent.text ?? shareIntent.webUrl ?? "";
    const files = shareIntent.files ?? [];
    resetShareIntent();
    void (async () => {
      const imported = await Promise.all(
        files.map((f) =>
          importFile(
            f.path,
            f.fileName ?? "attachment",
            f.mimeType,
            f.size ?? undefined,
          ),
        ),
      );
      validateAttachments(imported);
      // Android instant shares are handled natively, without opening this screen.
      setAttachments((old) => {
        const next = [...old, ...imported];
        try {
          validateAttachments(next);
          return next;
        } catch (e) {
          setToast((e as Error).message);
          return old;
        }
      });
      if (text) setDraft((old: string) => (old ? old + "\n" + text : text));
      pageStack.current = ["send"];
      setPrompt(nextPrompt);
      setPage("send");
    })().catch((e) => setToast(String(e.message ?? e)));
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  useEffect(() => {
    if (shareError) setToast(shareError);
  }, [shareError]);
  const mutateHistory = useCallback(
    (update: (items: Transfer[]) => Transfer[], receivedId?: string) => {
      const work = historyQueue.current
        .catch(() => {})
        .then(async () => {
          if (receivedId && seen.current.includes(receivedId)) return;
          const items = update(historyRef.current).slice(0, MAX_HISTORY);
          const ids = receivedId
            ? [...seen.current, receivedId].slice(-2000)
            : seen.current;
          await saveLocal("tunnel-history", { items, seen: ids });
          const previous = historyRef.current;
          historyRef.current = items;
          await releaseFiles(previous, items, attachmentsRef.current);
          seen.current = ids;
          setHistory(items);
        });
      historyQueue.current = work;
      return work;
    },
    [],
  );
  useEffect(() => {
    const connections = links.map((credentials) => {
      const connection = createConnection({
        credentials,
        random: Crypto.getRandomBytes,
        socket: (url) => new WebSocket(url) as unknown as SocketLike,
        onStatus: (next) =>
          setStatuses((old) => ({ ...old, [credentials.serverId]: next })),
        onStarted: () => setNativeDestinations(destinationsRef.current),
        onPeerName: (name) => {
          setLinks((old) => {
            const peer = old.find((c) => c.serverId === credentials.serverId);
            if (!peer || peer.desktopName === name) return old;
            const updated = upsertDesktop(old, { ...peer, desktopName: name });
            void saveDesktops(updated).catch(() =>
              setToast("Could not save desktop name."),
            );
            return updated;
          });
        },
        onError: () =>
          setToast(
            "Connection interrupted. Keep both devices on the same Wi-Fi.",
          ),
        onOutgoing: async (q) => {
          await mutateHistory((items) => [
            q,
            ...items.filter((x) => x.id !== q.id),
          ]);
        },
        onReceive: async (incoming: Quanta) => {
          const q = await storeQuanta(incoming);
          const duplicate = seen.current.includes(q.id);
          await mutateHistory(
            (items) => [
              {
                ...q,
                direction: "received",
                status: "delivered",
                peer: credentials.desktopName,
                serverId: credentials.serverId,
              },
              ...items,
            ],
            q.id,
          );
          if (duplicate) return;
          arrivalOpacity.setValue(1);
          arrivalScale.setValue(0.2);
          Animated.parallel([
            Animated.timing(arrivalScale, {
              toValue: reduced.current ? 1 : 2.4,
              duration: reduced.current ? 0 : 1800,
              useNativeDriver: true,
            }),
            Animated.timing(arrivalOpacity, {
              toValue: 0,
              duration: reduced.current ? 500 : 2100,
              useNativeDriver: true,
            }),
          ]).start();
          let copied = false;
          if (copyIncoming.current && q.text.trim())
            try {
              await Clipboard.setStringAsync(q.text);
              copied = true;
            } catch {
              setToast("Received. Copy the text from history.");
            }
          setToast(
            copied
              ? "Quanta received and copied."
              : "Quanta received. Find it in history.",
          );
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        },
      });
      clients.current.set(credentials.serverId, connection);
      connection.start();
      return connection;
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connections.forEach((connection) => {
          connection.start();
          connection.resume();
        });
      } else if (Platform.OS !== "android")
        connections.forEach((connection) => connection.stop());
    });
    return () => {
      sub.remove();
      connections.forEach((connection) => connection.dispose());
      clients.current.clear();
    };
  }, [links, mutateHistory]);
  const chooseDestination = (id: string) => {
    if (busy) return;
    const next = destinations.includes(id)
      ? destinations.filter((x) => x !== id)
      : [...destinations, id];
    setDestinations(next);
    void saveLocal("tunnel-destinations", next)
      .then(() => setNativeDestinations(next))
      .catch(() => setToast("Could not save destinations."));
  };
  const send = async (retry?: Transfer, sharedText?: string) => {
    setSheen((n) => n + 1);
    if (sending.current) return;
    const text = sharedText ?? retry?.text ?? draft;
    const files =
      sharedText === undefined ? (retry?.attachments ?? attachments) : [];
    const q: Quanta = {
      id: retry?.id ?? Crypto.randomUUID(),
      text,
      createdAt: retry?.createdAt ?? Date.now(),
      attachments: files,
    };
    let batch: Transfer[];
    try {
      validateQuanta(q);
      if (retry) {
        const target =
          retry.serverId ??
          (links.length === 1 ? links[0].serverId : undefined);
        if (!target || !links.some((c) => c.serverId === target))
          throw new Error(
            "The original desktop is no longer linked. Choose a destination and compose a new quanta.",
          );
        batch = [{ ...retry, serverId: target, status: "pending" }];
      } else
        batch = recipientTransfers(q, links, destinations, Crypto.randomUUID);
    } catch (e) {
      setToast((e as Error).message);
      return;
    }
    sending.current = true;
    setBusy(true);
    Keyboard.dismiss();
    try {
      const ids = new Set(batch.map((t) => t.id));
      await mutateHistory((items) => [
        ...batch,
        ...items.filter((t) => !ids.has(t.id)),
      ]);
      if (!reduced.current)
        Animated.timing(motion, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      const animationDone = new Promise((resolve) =>
        setTimeout(resolve, reduced.current ? 0 : 760),
      );
      const results = await Promise.allSettled(
        batch.map(async (transfer) => {
          try {
            const connection = clients.current.get(transfer.serverId!);
            if (!connection || connection.status !== "connected")
              throw new Error(transfer.peer + " is offline.");
            await connection.send(transfer);
            await mutateHistory((items) =>
              items.map((t) =>
                t.id === transfer.id ? { ...t, status: "delivered" } : t,
              ),
            );
          } catch (e) {
            await mutateHistory((items) =>
              items.map((t) =>
                t.id === transfer.id ? { ...t, status: "failed" } : t,
              ),
            );
            throw e;
          }
        }),
      );
      await animationDone;
      const delivered = results.filter((x) => x.status === "fulfilled").length;
      if (delivered === batch.length) {
        if (!retry && sharedText === undefined) {
          setDraft((current: string) => (current === text ? "" : current));
          setAttachments((current) => (current === files ? [] : current));
        }
        motion.setValue(0);
        if (!reduced.current) {
          entry.setValue(0);
          Animated.timing(entry, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
        setPrompt(nextPrompt);
        setToast("Received on " + batch.map((t) => t.peer).join(", ") + ".");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else
        setToast(
          `${delivered} of ${batch.length} received. Draft kept; retry failed destinations in history.`,
        );
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      // A failed send brings the kept draft back smoothly.
      Animated.timing(motion, {
        toValue: 0,
        duration: reduced.current ? 0 : 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      sending.current = false;
      setBusy(false);
    }
  };
  const attach = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const files = await Promise.all(
        picked.assets.map((a) => importFile(a.uri, a.name, a.mimeType, a.size)),
      );
      setAttachments((old) => {
        const next = [...old, ...files];
        try {
          validateAttachments(next);
          return next;
        } catch (e) {
          setToast((e as Error).message);
          return old;
        }
      });
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const changeShareSetting = async (
    key: keyof ShareSettings,
    value: boolean,
  ) => {
    try {
      const next = { ...shareSettings, [key]: value };
      await setShareSettings(next);
      updateShareSettings(next);
    } catch {
      setToast("Could not save sharing preference.");
    }
  };
  const paste = async () => {
    try {
      const value = await Clipboard.getStringAsync();
      if (!value) {
        setToast("Your clipboard is empty.");
        return;
      }
      setDraft((t: string) => (t ? t + "\n" + value : value));
      input.current?.focus();
    } catch {
      setToast("Could not read the clipboard. Paste directly into the input.");
    }
  };
  const pair = async (raw: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    try {
      const pairing = parsePairing(raw);
      const link = {
        ...pairing,
        deviceId: boot.deviceId,
        deviceName,
      };
      const next = upsertDesktop(linksRef.current, link);
      await saveDesktops(next);
      setLinks(next);
      const selected = destinationIds(next, [
        ...destinationsRef.current,
        link.serverId,
      ]);
      await saveLocal("tunnel-destinations", selected);
      setDestinations(selected);
      setScan(false);
      setCode("");
      setToast("Connecting to " + pairing.desktopName + "…");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setTimeout(() => {
        scanLocked.current = false;
      }, 1200);
    }
  };
  const unlink = (serverId: string) =>
    Alert.alert(
      "Unlink this desktop?",
      "Other desktops stay paired and history is kept.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: () => {
            const next = linksRef.current.filter(
              (c) => c.serverId !== serverId,
            );
            const selected = destinationIds(next, destinationsRef.current);
            void saveDesktops(next)
              .then(async () => {
                clients.current.get(serverId)?.stop();
                await saveLocal("tunnel-destinations", selected);
                setLinks(next);
                setDestinations(selected);
                setToast("Desktop unlinked.");
              })
              .catch(() => setToast("Could not unlink. Try again."));
          },
        },
      ],
    );
  const changeTheme = (changes: Partial<ThemePreferences>) => {
    const preferences = {
      themeId: aurora.selection.themeId,
      appearance: aurora.selection.appearance,
      ...changes,
    };
    controller.select(new AuroraSelection(preferences));
    void saveLocal("tunnel-theme", preferences).catch(() =>
      setToast("Could not save appearance."),
    );
  };
  const navigate = (p: Page) => {
    if (p !== page) {
      if (p === "send") {
        pageStack.current = ["send"];
        setPrompt(nextPrompt);
      } else pageStack.current.push(p);
    }
    setPage(p);
    if (p !== "settings") setSettingsPage("");
    if (p === "settings") setSettingsPage("");
    if (p === "send") setSheen((n) => n + 1);
    setMenu(false);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menu) {
        setMenu(false);
        return true;
      }
      if (scan) {
        setScan(false);
        return true;
      }
      if (input.current?.isFocused() || Keyboard.isVisible()) {
        input.current?.blur();
        Keyboard.dismiss();
        return true;
      }
      if (page === "settings" && settingsPage) {
        setSettingsPage("");
        return true;
      }
      if (pageStack.current.length > 1) {
        pageStack.current.pop();
        const next = pageStack.current.at(-1)!;
        if (next === "send") setPrompt(nextPrompt);
        setPage(next);
        return true;
      }
      if (page !== "send") {
        pageStack.current = ["send"];
        setPage("send");
        setPrompt(nextPrompt);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page, menu, scan, settingsPage]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (
        state === "active" &&
        previousAppState.current !== "active" &&
        page === "send"
      )
        setPrompt(nextPrompt);
      previousAppState.current = state;
    });
    return () => sub.remove();
  }, [page]);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () =>
      input.current?.blur(),
    );
    return () => sub.remove();
  }, []);
  const rename = async () => {
    if (nameSaving) return;
    setNameSaving(true);
    try {
      const name = validDeviceName(nameDraft);
      await saveLocal("tunnel-device-name", name);
      setDeviceName(name);
      const updated = linksRef.current.map((c) => ({ ...c, deviceName: name }));
      await saveDesktops(updated);
      setLinks(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1500);
      setToast("Device name saved.");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setNameSaving(false);
    }
  };
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const s = styles;
  const body = { color: c.ink };
  const muted = { color: c.muted, fontFamily: "DMSans_400Regular" };
  // The selector updates at once; the list follows without blocking taps.
  const shownFilter = useDeferredValue(filter);
  const shownSearch = useDeferredValue(search);
  const results = useMemo(
    () =>
      history.filter(
        (q) =>
          (shownFilter === "all" || q.direction === shownFilter) &&
          (q.text + " " + (q.attachments ?? []).map((a) => a.name).join(" "))
            .toLowerCase()
            .includes(shownSearch.toLowerCase()),
      ),
    [history, shownFilter, shownSearch],
  );
  const historyRows = useMemo(
    () => pairRows(results, compactQuanta),
    [results],
  );
  const iconButton = (
    icon: React.ReactNode,
    label: string,
    action: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      hitSlop={5}
      style={s.iconButton}
    >
      {icon}
    </Pressable>
  );
  const textButton = (
    label: string,
    action: () => void,
    disabled = false,
    primary = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={[
        s.softButton,
        primary && { minHeight: 60 },
        {
          backgroundColor: primary ? c.primary : c.tint,
          opacity: disabled ? (primary ? 0.4 : 0.45) : 1,
        },
      ]}
    >
      <Text
        style={[
          s.actionText,
          { color: primary ? c.onPrimary : c.tintInk },
          primary && { fontFamily: "DMSans_700Bold", fontSize: 16 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const field = [
    s.search,
    body,
    { borderColor: c.line, backgroundColor: c.inset },
  ];
  const ready =
    (!!draft.trim() || !!attachments.length) && status === "connected";
  const rail = (
    <SendRail
      c={{ ...c, paper: c.inset }}
      ready={ready}
      busy={busy}
      onUse={() => setSheen((n) => n + 1)}
      onSend={() => void send()}
    />
  );
  const title =
    page === "history"
      ? "History"
      : page === "devices"
        ? "Linked devices"
        : settingsPage === "appearance"
          ? "Appearance"
          : settingsPage === "share"
            ? "Share straight away"
            : settingsPage === "account"
              ? "Account"
              : "Settings";
  const saveAll = async (files: Attachment[]) => {
    try {
      for (const a of files) await saveFile(a);
      setToast("Files saved.");
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const copyTransfer = async (q: Transfer) => {
    try {
      if (q.text) await Clipboard.setStringAsync(q.text);
      else if (singleImage(q)) await copyPhoto(q.attachments![0]);
      else throw new Error("Open a file to save or share it.");
      quickToast("Copied", setToast);
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const historyCard = (q: Transfer, half: boolean) => (
    <View
      style={[
        s.panel,
        { backgroundColor: c.paper, borderColor: c.line },
        half && { flex: 1 },
      ]}
    >
      <View style={s.row}>
        {q.direction === "sent" ? (
          <ArrowUpRight size={16} color={c.primary} />
        ) : (
          <ArrowDownLeft size={16} color={c.primary} />
        )}
        <Text
          numberOfLines={half ? 1 : undefined}
          style={[s.subtitle, muted, { flex: 1 }]}
        >
          {q.direction === "sent" ? "To" : "From"} {q.peer} ·{" "}
          {new Date(q.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      {!!q.text && (
        <Text selectable style={[s.historyText, body]}>
          {q.text}
        </Text>
      )}
      {!!q.attachments?.some((a) => a.mimeType.startsWith("image/")) && (
        <View style={[s.row, half && { justifyContent: "center", flex: 1 }]}>
          <PhotoStack
            photos={q.attachments.filter((a) =>
              a.mimeType.startsWith("image/"),
            )}
            onOpen={() =>
              setPhotos(
                q.attachments!.filter((a) => a.mimeType.startsWith("image/")),
              )
            }
          />
          {!half && (
            <Text style={[s.actionText, body]}>
              {
                q.attachments.filter((a) => a.mimeType.startsWith("image/"))
                  .length
              }{" "}
              photos
            </Text>
          )}
        </View>
      )}
      {(q.attachments ?? [])
        .filter((a) => !a.mimeType.startsWith("image/"))
        .map((a, i) => (
          <View key={i} style={s.fileRow}>
            <Paperclip size={18} color={c.primary} />
            <Text style={[s.actionText, body, { flex: 1 }]}>{a.name}</Text>
            {iconButton(
              <Download size={17} color={c.muted} />,
              "Save " + a.name,
              () => void saveAll([a]),
            )}
            {iconButton(
              <Share2 size={17} color={c.muted} />,
              "Share " + a.name,
              () => void shareFile(a).catch((e) => setToast(e.message)),
            )}
          </View>
        ))}
      <View style={s.row}>
        <CheckCheck
          size={14}
          color={q.status === "failed" ? c.error : c.primary}
        />
        <Text numberOfLines={1} style={[s.subtitle, muted, { flex: 1 }]}>
          {q.status === "delivered"
            ? "Received"
            : q.status === "pending"
              ? "Awaiting receipt"
              : "Receipt unconfirmed"}
        </Text>
        {q.status === "failed" && q.direction === "sent" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry transfer"
            disabled={
              busy ||
              statuses[
                q.serverId ?? (links.length === 1 ? links[0].serverId : "")
              ] !== "connected"
            }
            onPress={() => void send(q)}
            style={s.iconButton}
          >
            <RefreshCw size={18} color={c.primary} />
          </Pressable>
        )}
        {(q.attachments?.length ?? 0) > 0 &&
          !singleImage(q) &&
          iconButton(
            <Download size={17} color={c.muted} />,
            "Download all",
            () => void saveAll(q.attachments!),
          )}
        {!!q.text &&
          iconButton(
            <Maximize2 size={17} color={c.muted} />,
            "Expand quanta",
            () => setExpanded(q),
          )}
        {(!!q.text || singleImage(q)) &&
          iconButton(
            <Copy size={17} color={c.muted} />,
            singleImage(q) && !q.text ? "Copy photo" : "Copy quanta",
            () => void copyTransfer(q),
          )}
      </View>
    </View>
  );
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <StatusBar
        style={aurora.variant.appearance === "dark" ? "light" : "dark"}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {page === "send" ? (
          <View style={{ flex: 1 }}>
            <DotField trigger={sheen} ink={c.ink} accent={c.primary} />
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FadeScroll
                style={{ flex: 1, minWidth: 0 }}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
              >
                {links.map((link) => (
                  <Pressable
                    key={link.serverId}
                    disabled={busy}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: destinations.includes(link.serverId),
                    }}
                    onPress={() => chooseDestination(link.serverId)}
                    style={[
                      s.chip,
                      {
                        borderColor: destinations.includes(link.serverId)
                          ? c.primary
                          : c.line,
                        backgroundColor: c.deep,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.statusDot,
                        {
                          backgroundColor:
                            statuses[link.serverId] === "connected"
                              ? c.primary
                              : c.muted,
                        },
                      ]}
                    />
                    <Text style={[s.actionText, body]}>{link.desktopName}</Text>
                    {destinations.includes(link.serverId) && (
                      <Check size={14} color={c.primary} />
                    )}
                  </Pressable>
                ))}
                {iconButton(
                  <Plus size={20} color={c.primary} />,
                  "Link desktop",
                  () => navigate("devices"),
                )}
              </FadeScroll>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Connection status. Open linked devices."
                onPress={() => navigate("devices")}
                style={[s.connection, { borderColor: c.line }]}
              >
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor:
                        status === "connected" ? c.primary : c.muted,
                    },
                  ]}
                />
                <Text style={[s.connectionText, muted]}>
                  {status === "connected"
                    ? "Linked"
                    : status === "connecting"
                      ? "Connecting"
                      : "Offline"}
                </Text>
              </Pressable>
            </View>
            <View
              style={[
                s.sendPage,
                { flexDirection: sendLayout === "under" ? "column" : "row" },
              ]}
            >
              {sendLayout === "left" && rail}
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <Animated.View
                  style={{
                    flex: 1,
                    opacity: composerMotion.opacity,
                    transform: [
                      { translateY: composerMotion.translateY },
                      { scale: composerMotion.scale },
                    ],
                  }}
                >
                  <TextInput
                    ref={input}
                    multiline
                    value={draft}
                    onChangeText={setDraft}
                    accessibilityLabel="Quanta text"
                    placeholder={attachments.length ? "Add a note…" : " "}
                    placeholderTextColor={c.muted}
                    selectionColor={c.primary}
                    textAlignVertical="top"
                    style={[
                      s.input,
                      body,
                      { minHeight: attachments.length ? 72 : 180 },
                    ]}
                  />
                  {!draft && !attachments.length && (
                    <View pointerEvents="none" style={s.emptyQuanta}>
                      <BrandMark size={96} />
                      <Text style={[s.placeholderTitle, body]}>
                        Ready to stochastically appear somewhere else?
                      </Text>
                      <Text style={[s.subtitle, muted]}>
                        Tap here and let a thought in.
                      </Text>
                    </View>
                  )}
                  {!!attachments.length && (
                    <FadeScroll
                      style={{ flex: 1 }}
                      contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: "center",
                      }}
                      keyboardShouldPersistTaps="handled"
                    >
                      <PhotoStack
                        composer
                        large={
                          !draft.trim() &&
                          attachments.every((a) =>
                            a.mimeType.startsWith("image/"),
                          )
                        }
                        photos={attachments.filter((a) =>
                          a.mimeType.startsWith("image/"),
                        )}
                        onRemove={(photo) => {
                          if (!busy)
                            setAttachments((old) =>
                              old.filter((a) => a !== photo),
                            );
                        }}
                      />
                      {attachments
                        .filter((a) => !a.mimeType.startsWith("image/"))
                        .map((a, index) => (
                          <View
                            key={a.uri ?? index}
                            style={[
                              s.fileRow,
                              { borderColor: c.line, backgroundColor: c.deep },
                            ]}
                          >
                            <Paperclip size={18} color={c.primary} />
                            <Text
                              numberOfLines={1}
                              style={[s.actionText, body, { flex: 1 }]}
                            >
                              {a.name}
                            </Text>
                            {iconButton(
                              <X size={16} color={c.muted} />,
                              "Remove " + a.name,
                              () => {
                                if (!busy)
                                  setAttachments((old) =>
                                    old.filter((photo) => photo !== a),
                                  );
                              },
                            )}
                          </View>
                        ))}
                    </FadeScroll>
                  )}
                </Animated.View>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    {textButton("Attach", () => void attach(), busy)}
                  </View>
                  <View style={{ flex: 1 }}>
                    {textButton("Paste", () => void paste(), busy)}
                  </View>
                </View>
              </View>
              {sendLayout === "right" && rail}
              {sendLayout === "under" &&
                (underControl === "slider" ? (
                  <SendRail
                    c={{ ...c, paper: c.inset }}
                    horizontal
                    ready={ready}
                    busy={busy}
                    onUse={() => setSheen((n) => n + 1)}
                    onSend={() => void send()}
                  />
                ) : (
                  textButton(
                    busy ? "Tunneling…" : "Tunnel",
                    () => void send(),
                    !ready || busy,
                    true,
                  )
                ))}
            </View>
          </View>
        ) : null}
        {page !== "send" && page !== "singularity" && (
          <View style={s.heading}>
            {(page === "devices" || !!settingsPage) &&
              iconButton(<ArrowLeft size={22} color={c.ink} />, "Back", () => {
                if (page === "devices") navigate("settings");
                else setSettingsPage("");
              })}
            <Text style={[s.title, body]}>{title}</Text>
          </View>
        )}
        <View
          style={{
            flex: 1,
            display:
              page === "singularity" ||
              (page === "settings" && settingsPage === "account")
                ? "flex"
                : "none",
          }}
        >
          <SingularityPanel
            accountOnly={page === "settings"}
            onSettings={() => {
              navigate("settings");
              setSettingsPage("account");
            }}
            onTunnel={(value) => void send(undefined, value)}
          />
        </View>
        {page !== "send" &&
          page !== "singularity" &&
          !(page === "settings" && settingsPage === "account") && (
            <>
              {page === "history" && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
                  <View
                    style={[
                      s.segmented,
                      { backgroundColor: c.inset, borderColor: c.line },
                    ]}
                  >
                    {(["received", "sent", "all"] as const).map((f) => (
                      <Pressable
                        key={f}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filter === f }}
                        onPress={() => setFilter(f)}
                        style={[
                          s.segment,
                          {
                            backgroundColor:
                              filter === f ? c.primary : "transparent",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.actionText,
                            filter === f
                              ? {
                                  color: c.onPrimary,
                                  fontFamily: "DMSans_700Bold",
                                }
                              : muted,
                          ]}
                        >
                          {f[0].toUpperCase() + f.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    accessibilityLabel="Search history"
                    placeholder="Search quanta…"
                    placeholderTextColor={c.muted}
                    value={search}
                    onChangeText={setSearch}
                    style={field}
                  />
                </View>
              )}
              {page === "history" ? (
                <FadeList
                  style={{ flex: 1 }}
                  contentContainerStyle={s.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  data={historyRows}
                  keyExtractor={(row) => row[0].id}
                  // Only nearby cards mount, so filters and tab switches stay fast.
                  initialNumToRender={5}
                  maxToRenderPerBatch={4}
                  windowSize={5}
                  renderItem={({ item: row }) =>
                    row.length === 1 && !compactQuanta(row[0]) ? (
                      historyCard(row[0], false)
                    ) : (
                      // Photo-only quanta share a row; a lone one keeps its half.
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        {row.map((q) => (
                          <View key={q.id} style={{ flex: 1, minWidth: 0 }}>
                            {historyCard(q, true)}
                          </View>
                        ))}
                        {row.length === 1 && <View style={{ flex: 1 }} />}
                      </View>
                    )
                  }
                  ListFooterComponent={
                    <View style={{ gap: 12 }}>
                      {!results.length && (
                        <View style={s.emptyPage}>
                          <History size={32} color={c.primary} />
                          <Text style={[s.sectionTitle, body]}>
                            {search
                              ? "No matching quanta."
                              : "Your thoughts will leave a trail."}
                          </Text>
                        </View>
                      )}
                      <Text style={[s.subtitle, muted]}>
                        The latest 200 transfers. Stored on this device.
                      </Text>
                      {!!history.length &&
                        textButton("Clear history", () =>
                          Alert.alert(
                            "Clear your trail?",
                            "This removes transfer history from your phone.",
                            [
                              { text: "Keep it", style: "cancel" },
                              {
                                text: "Clear",
                                style: "destructive",
                                onPress: () =>
                                  void mutateHistory(() => []).catch(() =>
                                    setToast("Could not clear history."),
                                  ),
                              },
                            ],
                          ),
                        )}
                    </View>
                  }
                />
              ) : (
                <FadeScroll
                  style={{ flex: 1 }}
                  contentContainerStyle={s.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {page === "devices" && (
                    <>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <Text style={[s.sectionTitle, body]}>
                          This phone’s name
                        </Text>
                        <TextInput
                          accessibilityLabel="Device name"
                          value={nameDraft}
                          onChangeText={setNameDraft}
                          maxLength={80}
                          style={[
                            s.search,
                            body,
                            { borderColor: c.line, backgroundColor: c.surface },
                          ]}
                        />
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void rename()}
                          disabled={nameSaving}
                          style={({ pressed }) => [
                            s.softButton,
                            {
                              backgroundColor: nameSaved ? c.primary : c.tint,
                              transform: [{ scale: pressed ? 0.97 : 1 }],
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.actionText,
                              { color: nameSaved ? c.onPrimary : c.tintInk },
                            ]}
                          >
                            {nameSaving
                              ? "Saving…"
                              : nameSaved
                                ? "✓ Saved"
                                : "Save name"}
                          </Text>
                        </Pressable>
                      </View>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <Text style={[s.eyebrow, muted]}>
                          {links.length
                            ? "YOUR LINKED DESKTOPS"
                            : "OPEN A TUNNEL"}
                        </Text>
                        {links.map((link) => (
                          <View
                            key={link.serverId}
                            style={{
                              paddingVertical: 14,
                              borderBottomWidth: 1,
                              borderColor: c.line,
                              gap: 8,
                            }}
                          >
                            <Pressable
                              disabled={busy}
                              accessibilityRole="checkbox"
                              accessibilityState={{
                                checked: destinations.includes(link.serverId),
                              }}
                              onPress={() => chooseDestination(link.serverId)}
                              style={{
                                flexDirection: "row",
                                gap: 10,
                                alignItems: "center",
                                minHeight: 48,
                              }}
                            >
                              <Text style={{ color: c.primary, fontSize: 20 }}>
                                {destinations.includes(link.serverId)
                                  ? "●"
                                  : "○"}
                              </Text>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.actionText, body]}>
                                  {link.desktopName}
                                </Text>
                                <Text style={[s.subtitle, muted]}>
                                  {statuses[link.serverId] === "connected"
                                    ? "Connected · local network"
                                    : "Offline · same Wi-Fi required"}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable
                              disabled={busy}
                              accessibilityRole="button"
                              onPress={() => unlink(link.serverId)}
                              style={[
                                s.softButton,
                                { backgroundColor: c.tint },
                              ]}
                            >
                              <Unplug size={17} color={c.tintInk} />
                              <Text
                                style={[s.actionText, { color: c.tintInk }]}
                              >
                                Unlink this desktop
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                        <>
                          <Text
                            style={[
                              s.sectionTitle,
                              body,
                              { marginTop: links.length ? 16 : 6 },
                            ]}
                          >
                            Link another desktop.
                          </Text>
                          <Text style={[s.subtitle, muted]}>
                            Open Linked devices on your desktop, then scan its
                            pairing code.
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={async () => {
                              const p = permission?.granted
                                ? permission
                                : await requestPermission();
                              if (p.granted) {
                                scanLocked.current = false;
                                setScan(true);
                              } else
                                setToast(
                                  "Allow camera access in Android settings, or paste a pairing code.",
                                );
                            }}
                            style={[s.scanButton, { backgroundColor: c.tint }]}
                          >
                            <ScanLine size={34} color={c.tintInk} />
                            <Text style={[s.actionText, { color: c.tintInk }]}>
                              Scan desktop QR
                            </Text>
                          </Pressable>
                        </>
                      </View>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <>
                          <Text style={[s.sectionTitle, body]}>
                            Paste a pairing code
                          </Text>
                          <TextInput
                            accessibilityLabel="Pairing code"
                            value={code}
                            onChangeText={setCode}
                            placeholder="Paste your code here…"
                            placeholderTextColor={c.muted}
                            autoCapitalize="none"
                            multiline
                            style={[s.codeInput, body, { borderColor: c.line }]}
                          />
                          <Pressable
                            accessibilityRole="button"
                            disabled={!code.trim()}
                            onPress={() => void pair(code)}
                            style={[
                              s.softButton,
                              {
                                backgroundColor: c.tint,
                                opacity: code.trim() ? 1 : 0.4,
                              },
                            ]}
                          >
                            <Link2 size={17} color={c.tintInk} />
                            <Text style={[s.actionText, { color: c.tintInk }]}>
                              Link desktop
                            </Text>
                          </Pressable>
                        </>
                      </View>
                      <View style={s.privacyNote}>
                        <ShieldCheck size={19} color={c.primary} />
                        <Text style={[s.subtitle, muted]}>
                          Direct across your local network.{"\n"}Encrypted
                          between your devices.
                        </Text>
                      </View>
                      <Text style={[s.sendHint, muted]}>
                        Tunnel stays connected in the background on Android.
                      </Text>
                    </>
                  )}
                  {page === "settings" && !settingsPage && (
                    <View
                      style={[
                        s.panel,
                        { backgroundColor: c.paper, borderColor: c.line },
                      ]}
                    >
                      {[
                        {
                          key: "share",
                          label: "Share straight away",
                          description: "Choose what tunnels without review",
                          Icon: Share2,
                        },
                        {
                          key: "appearance",
                          label: "Appearance",
                          description: "Theme, light and dark, send control",
                          Icon: Sparkles,
                        },
                        {
                          key: "devices",
                          label: "Linked devices",
                          description: `${links.length} linked desktops`,
                          Icon: Link2,
                        },
                        {
                          key: "account",
                          label: "Account",
                          description: "Singularity sign-in and sync",
                          Icon: ShieldCheck,
                        },
                      ].map(({ key, label, description, Icon }, i, all) => (
                        <Pressable
                          key={key}
                          accessibilityRole="button"
                          onPress={() =>
                            key === "devices"
                              ? navigate("devices")
                              : setSettingsPage(
                                  key as "share" | "appearance" | "account",
                                )
                          }
                          style={[
                            s.settingsLink,
                            {
                              borderColor: c.line,
                              borderBottomWidth: i === all.length - 1 ? 0 : 1,
                            },
                          ]}
                        >
                          <Icon size={21} color={c.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.settingTitle, body]}>{label}</Text>
                            <Text style={[s.subtitle, muted]}>
                              {description}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={c.muted} />
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {page === "settings" && settingsPage === "appearance" && (
                    <>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <View style={s.historyMeta}>
                          <Sparkles size={15} color={c.primary} />
                          <Text style={[s.eyebrow, muted]}>Theme</Text>
                        </View>
                        <Text style={[s.sectionTitle, body]}>
                          Make it yours.
                        </Text>
                        <View style={s.themeRow}>
                          {themes.map((t) => (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: aurora.selection.themeId === t.id,
                              }}
                              key={t.id}
                              onPress={() => changeTheme({ themeId: t.id })}
                              style={[
                                s.themeOption,
                                {
                                  borderColor:
                                    aurora.selection.themeId === t.id
                                      ? c.primary
                                      : c.line,
                                },
                              ]}
                            >
                              <View
                                style={[
                                  s.swatch,
                                  {
                                    backgroundColor: nativeColor(
                                      t.variants.get("light")!.tokens.surface,
                                    ),
                                  },
                                ]}
                              >
                                <View
                                  style={{
                                    height: 25,
                                    width: 20,
                                    borderRadius: 5,
                                    backgroundColor: nativeColor(
                                      t.variants.get("light")!.tokens.primary,
                                    ),
                                  }}
                                />
                              </View>
                              <Text style={[s.actionText, body]}>{t.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={[s.footerText, muted]}>APPEARANCE</Text>
                        <View
                          style={[
                            s.segmented,
                            { borderColor: c.line, backgroundColor: c.surface },
                          ]}
                        >
                          {(["light", "dark", "system"] as const).map((a) => (
                            <Pressable
                              key={a}
                              accessibilityRole="button"
                              accessibilityState={{
                                selected: aurora.selection.appearance === a,
                              }}
                              onPress={() => changeTheme({ appearance: a })}
                              style={[
                                s.segment,
                                {
                                  backgroundColor:
                                    aurora.selection.appearance === a
                                      ? c.tint
                                      : "transparent",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  s.actionText,
                                  {
                                    color:
                                      aurora.selection.appearance === a
                                        ? c.tintInk
                                        : c.muted,
                                  },
                                ]}
                              >
                                {a[0].toUpperCase() + a.slice(1)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <Text style={[s.sectionTitle, body]}>Send control</Text>
                        <Text style={[s.subtitle, muted]}>
                          Put the particle where your hand expects it.
                        </Text>
                        <View style={s.segmented}>
                          {(["left", "right", "under"] as const).map(
                            (position) => (
                              <Pressable
                                key={position}
                                onPress={() =>
                                  void saveLocal("tunnel-send-layout", position)
                                    .then(() => setSendLayout(position))
                                    .catch(() =>
                                      setToast("Could not save layout."),
                                    )
                                }
                                style={[
                                  s.segment,
                                  {
                                    backgroundColor:
                                      sendLayout === position
                                        ? c.tint
                                        : "transparent",
                                  },
                                ]}
                              >
                                <Text style={[s.actionText, body]}>
                                  {position[0].toUpperCase() +
                                    position.slice(1)}
                                </Text>
                              </Pressable>
                            ),
                          )}
                        </View>
                        {sendLayout === "under" && (
                          <View style={s.segmented}>
                            {(["slider", "button"] as const).map((control) => (
                              <Pressable
                                key={control}
                                onPress={() =>
                                  void saveLocal(
                                    "tunnel-under-control",
                                    control,
                                  )
                                    .then(() => setUnderControl(control))
                                    .catch(() =>
                                      setToast("Could not save control."),
                                    )
                                }
                                style={[
                                  s.segment,
                                  {
                                    backgroundColor:
                                      underControl === control
                                        ? c.tint
                                        : "transparent",
                                  },
                                ]}
                              >
                                <Text style={[s.actionText, body]}>
                                  {control[0].toUpperCase() + control.slice(1)}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    </>
                  )}
                  {page === "settings" && settingsPage === "share" && (
                    <>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <Text style={[s.sectionTitle, body]}>
                          Share straight away
                        </Text>
                        <Text style={[s.subtitle, muted]}>
                          Shared quanta tunnel in the background. Turn off to
                          review and add a note first.
                        </Text>
                        {(["text", "image", "file"] as const).map((key) => (
                          <View
                            key={key}
                            style={[s.settingRow, { marginTop: 18 }]}
                          >
                            <Text style={[s.settingTitle, body, { flex: 1 }]}>
                              {key === "text"
                                ? "Text"
                                : key === "image"
                                  ? "Images"
                                  : "Other files"}
                            </Text>
                            <Switch
                              accessibilityLabel={
                                "Automatically tunnel shared " + key
                              }
                              value={shareSettings[key]}
                              onValueChange={(v) =>
                                void changeShareSetting(key, v)
                              }
                              trackColor={{ true: c.primary, false: c.line }}
                            />
                          </View>
                        ))}
                      </View>
                      <View
                        style={[
                          s.panel,
                          { backgroundColor: c.paper, borderColor: c.line },
                        ]}
                      >
                        <View style={s.settingRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.settingTitle, body]}>
                              Automatically copy incoming text
                            </Text>
                            <Text style={[s.subtitle, muted]}>
                              Ready to paste as soon as it arrives.
                            </Text>
                          </View>
                          <Switch
                            accessibilityLabel="Automatically copy incoming text"
                            value={autoCopy}
                            trackColor={{ false: c.line, true: c.primary }}
                            thumbColor={c.paper}
                            onValueChange={async (value) => {
                              try {
                                await saveLocal("tunnel-auto-copy", value);
                                setAutoCopy(value);
                              } catch {
                                setToast(
                                  "Could not save clipboard preference.",
                                );
                              }
                            }}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </FadeScroll>
              )}
            </>
          )}
      </KeyboardAvoidingView>
      <View
        style={[
          s.tabbar,
          {
            backgroundColor: c.deep,
            borderColor: c.line,
            paddingBottom: 10 + insets.bottom,
          },
        ]}
      >
        {navigation.map(({ id, label, icon: Icon }) => {
          const active =
            page === id || (page === "devices" && id === "settings");
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => navigate(id)}
              style={s.tab}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.5 : 1.8}
                color={active ? c.primary : c.muted}
              />
              <Text
                style={{
                  fontFamily: active ? "DMSans_700Bold" : "DMSans_500Medium",
                  fontSize: 11,
                  color: active ? c.primary : c.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={scan} onRequestClose={() => setScan(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
          <View style={s.heading}>
            <Text style={[s.sectionTitle, body]}>Scan your desktop</Text>
            {iconButton(<X size={22} color={c.ink} />, "Close scanner", () =>
              setScan(false),
            )}
          </View>
          {scan && permission?.granted && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => void pair(data)}
            />
          )}
          <Text style={[s.subtitle, muted, { padding: 24 }]}>
            Point at the QR in Tunnel’s Linked devices page.
          </Text>
        </SafeAreaView>
      </Modal>
      <PhotoViewer
        photos={photos}
        onClose={() => setPhotos([])}
        onMessage={setToast}
      />
      <Modal
        visible={!!expanded}
        transparent
        onRequestClose={() => setExpanded(null)}
      >
        <Pressable onPress={() => setExpanded(null)} style={s.scrim}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[s.panel, { backgroundColor: c.deep, maxHeight: "80%" }]}
          >
            <View style={s.row}>
              <Text style={[s.sectionTitle, body, { flex: 1 }]}>Quanta</Text>
              {iconButton(<X size={22} color={c.ink} />, "Close", () =>
                setExpanded(null),
              )}
            </View>
            <FadeScroll>
              <Text selectable style={[s.historyText, body]}>
                {expanded?.text}
              </Text>
            </FadeScroll>
            {textButton("Copy", () => expanded && void copyTransfer(expanded))}
          </Pressable>
        </Pressable>
      </Modal>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: arrivalOpacity,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: c.tint, opacity: 0.18 },
          ]}
        />
        <Animated.View
          style={{
            width: viewport.width * 1.2,
            height: viewport.width * 1.2,
            borderRadius: viewport.width,
            borderWidth: 2,
            borderColor: c.primary,
            transform: [{ scale: arrivalScale }],
          }}
        />
      </Animated.View>
      {!!toast && (
        <Pressable
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          accessibilityLabel={toast}
          onPress={() => {
            if (toast.startsWith("Quanta received")) navigate("history");
            setToast("");
          }}
          style={[
            s.toast,
            {
              backgroundColor: c.tint,
              borderColor: c.line,
              bottom: keyboardHeight
                ? Math.max(
                    12,
                    keyboardHeight -
                      (Dimensions.get("screen").height - viewport.height) +
                      12,
                  )
                : 78,
            },
          ]}
        >
          <Text
            style={{
              color: c.tintInk,
              flex: 1,
              fontFamily: "DMSans_500Medium",
            }}
          >
            {toast}
          </Text>
          {iconButton(
            <X size={16} color={c.tintInk} />,
            "Dismiss message",
            () => setToast(""),
          )}
        </Pressable>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  brand: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 23,
    letterSpacing: -0.8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  connection: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectionText: { fontSize: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 18,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
  },
  title: { fontFamily: "DMSans_600SemiBold", fontSize: 28, letterSpacing: -1 },
  subtitle: { fontFamily: "DMSans_400Regular", fontSize: 13, lineHeight: 19 },
  sendPage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
    minHeight: 260,
  },
  input: {
    fontFamily: "DMSans_400Regular",
    fontSize: 22,
    lineHeight: 29,
    padding: 8,
    flex: 1,
  },
  emptyQuanta: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 8,
  },
  placeholderTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 27,
    lineHeight: 31,
    textAlign: "center",
    letterSpacing: -1,
    maxWidth: 270,
  },
  actionText: { fontFamily: "DMSans_500Medium", fontSize: 14 },
  softButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  fileRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderRadius: 14,
    padding: 8,
    marginBottom: 8,
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 9,
  },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    marginBottom: 8,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    marginBottom: 4,
  },
  historyText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  emptyPage: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  sectionTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 18,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  settingTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    marginBottom: 4,
  },
  settingsLink: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 1,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  tabbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  themeRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  themeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    height: 48,
    width: "100%",
    borderRadius: 10,
    padding: 8,
    justifyContent: "flex-end",
  },
  eyebrow: { fontFamily: "DMSans_600SemiBold", fontSize: 11, letterSpacing: 1 },
  historyMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerText: { fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18 },
  scanButton: { padding: 20, borderRadius: 18, alignItems: "center", gap: 12 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 80,
    fontFamily: "DMSans_400Regular",
  },
  privacyNote: { flexDirection: "row", gap: 12 },
  sendHint: { textAlign: "center", fontSize: 12, lineHeight: 18 },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(14,20,28,.72)",
    justifyContent: "center",
    padding: 20,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 8,
  },
});
