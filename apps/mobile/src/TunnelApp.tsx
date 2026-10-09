import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Alert,
  Animated,
  AppState,
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import Svg, { Circle, Ellipse } from "react-native-svg";
import SendRail from "./SendRail";
import {
  composerPrompts,
  nextPrompt,
  validDeviceName,
} from "@tunnel/shared/composer";
import {
  createConnection,
  getShareSettings,
  setShareSettings,
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
import { saveCredentials, saveLocal, type BootState } from "./storage";

type Page = "send" | "history" | "devices" | "settings";
const navigation = [
  { id: "send", label: "Tunnel", icon: Plus },
  { id: "history", label: "Transfer history", icon: History },
  { id: "devices", label: "Linked devices", icon: Link2 },
  { id: "settings", label: "Appearance & settings", icon: Settings2 },
] as const;
function Orbit({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse
        cx={32}
        cy={32}
        rx={27}
        ry={10}
        stroke={color}
        strokeWidth={1.2}
        fill="none"
        rotation={35}
        origin="32,32"
      />
      <Ellipse
        cx={32}
        cy={32}
        rx={27}
        ry={10}
        stroke={color}
        strokeWidth={1.2}
        fill="none"
        rotation={-35}
        origin="32,32"
      />
      <Ellipse
        cx={32}
        cy={32}
        rx={27}
        ry={10}
        stroke={color}
        strokeWidth={1.2}
        fill="none"
        rotation={90}
        origin="32,32"
      />
      <Circle cx={32} cy={32} r={2.5} fill={color} />
    </Svg>
  );
}

export default function TunnelApp({ boot }: { boot: BootState }) {
  const tokens = useAuroraTokens();
  const controller = useAuroraController();
  const aurora = useAuroraState();
  const c = {
    surface: nativeColor(tokens.surface),
    paper: nativeColor(tokens.surfaceContainerLow),
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
  const [viewImage, setViewImage] = useState<Attachment | null>(null);
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
  const [credentials, setCredentials] = useState<Credentials | null>(
    boot.credentials,
  );
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [autoCopy, setAutoCopy] = useState(boot.autoCopy);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">("received");
  const input = useRef<TextInput>(null);
  const client = useRef<ReturnType<typeof createConnection> | null>(null);
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
    if (!credentials) {
      setStatus("offline");
      return;
    }
    const connection = createConnection({
      credentials,
      random: Crypto.getRandomBytes,
      socket: (url) => new WebSocket(url) as unknown as SocketLike,
      onStatus: setStatus,
      onPeerName: (name) => {
        setCredentials((old) => {
          if (!old || old.desktopName === name) return old;
          const updated = { ...old, desktopName: name };
          void saveCredentials(updated);
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
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(arrivalOpacity, {
            toValue: 0,
            duration: 950,
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
    client.current = connection;
    connection.start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connection.start();
        connection.resume?.();
      } else if (Platform.OS !== "android") connection.stop();
    });
    return () => {
      sub.remove();
      connection.dispose();
      client.current = null;
    };
  }, [credentials, mutateHistory]);
  const send = async (retry?: Transfer) => {
    if (sending.current) return;
    const text = retry?.text ?? draft;
    const files = retry?.attachments ?? attachments;
    const q: Quanta = {
      id: retry?.id ?? Crypto.randomUUID(),
      text,
      createdAt: retry?.createdAt ?? Date.now(),
      attachments: files,
    };
    try {
      validateQuanta(q);
    } catch (e) {
      setToast((e as Error).message);
      return;
    }
    if (client.current?.status !== "connected") {
      setToast("Link your desktop and keep both devices on the same Wi-Fi.");
      return;
    }
    sending.current = true;
    setBusy(true);
    Keyboard.dismiss();
    try {
      await mutateHistory((items) => [
        {
          ...q,
          direction: "sent",
          status: "pending",
          peer: credentials!.desktopName,
        },
        ...items.filter((x) => x.id !== q.id),
      ]);
      if (!reduced.current)
        Animated.timing(motion, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }).start();
      await client.current.send(q);
      await mutateHistory((items) =>
        items.map((x) => (x.id === q.id ? { ...x, status: "delivered" } : x)),
      );
      if (!retry)
        setDraft((current: string) => (current === text ? "" : current));
      if (!retry)
        setAttachments((current) => (current === files ? [] : current));
      setPrompt(nextPrompt);
      setToast("Received on " + credentials!.desktopName + ".");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } catch (e) {
      await mutateHistory((items) =>
        items.map((x) => (x.id === q.id ? { ...x, status: "failed" } : x)),
      ).catch(() => {});
      setToast((e as Error).message);
    } finally {
      motion.setValue(0);
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
      await saveCredentials(link);
      setCredentials(link);
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
  const unlink = () =>
    Alert.alert("Close this tunnel?", "Scan a new QR to reconnect.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: () => {
          client.current?.stop();
          void saveCredentials(null)
            .then(() => {
              setCredentials(null);
              setToast("Device unlinked.");
            })
            .catch(() => setToast("Could not unlink. Try again."));
        },
      },
    ]);
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
  }, [page, menu, scan]);
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
      if (credentials) {
        const updated = { ...credentials, deviceName: name };
        await saveCredentials(updated);
        setCredentials(updated);
      }
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
  const label =
    page === "send"
      ? "Context, in "
      : page === "history"
        ? "A trail of "
        : page === "devices"
          ? "Meet the "
          : "Make it ";
  const italic =
    page === "send"
      ? "motion."
      : page === "history"
        ? "quanta."
        : page === "devices"
          ? "other side."
          : "yours.";
  const s = styles;
  const body = { color: c.ink };
  const muted = { color: c.muted, fontFamily: "DMSans_400Regular" };
  const results = history.filter(
    (q) =>
      (filter === "all" || q.direction === filter) &&
      (q.text + " " + (q.attachments ?? []).map((a) => a.name).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const iconButton = (
    icon: React.ReactNode,
    label: string,
    action: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={action}
      style={s.iconButton}
    >
      {icon}
    </Pressable>
  );
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <StatusBar
        style={aurora.variant.appearance === "dark" ? "light" : "dark"}
      />
      <View style={[s.header, { borderColor: c.line }]}>
        <View style={s.brandGroup}>
          {iconButton(<Menu size={22} color={c.ink} />, "Open navigation", () =>
            setMenu(true),
          )}
          <Orbit color={c.primary} size={28} />
          <Text style={[s.brand, body]}>
            Tunnel<Text style={{ color: c.primary }}>.</Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connection status. Open linked devices."
          onPress={() => navigate("devices")}
          style={[s.connection, { borderColor: c.line }]}
        >
          <View
            style={[
              s.statusDot,
              { backgroundColor: status === "connected" ? c.primary : c.muted },
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {page !== "send" && (
          <View style={s.heading}>
            <Text style={[s.title, body]}>
              {label}
              <Text
                style={{
                  fontFamily: "InstrumentSerif_400Regular_Italic",
                  color: c.primary,
                }}
              >
                {italic}
              </Text>
            </Text>
            <Text style={[s.subtitle, muted]}>
              {page === "history"
                ? "All quanta you've tunneled"
                : page === "devices"
                  ? "One scan. Two devices. A shorter distance."
                  : "Powered by Aurora. Tuned to your comfort."}
            </Text>
          </View>
        )}
        {page === "send" ? (
          <View
            style={[
              s.sendPage,
              {
                flexDirection: sendLayout === "under" ? "column" : "row",
                gap: 10,
                paddingTop: 14,
                paddingBottom: 12,
              },
            ]}
          >
            {sendLayout === "left" && (
              <SendRail
                c={c}
                ready={
                  (!!draft.trim() || !!attachments.length) &&
                  status === "connected"
                }
                busy={busy}
                onSend={() => void send()}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.composerRow}>
                <View
                  style={[
                    s.card,
                    { backgroundColor: c.paper, borderColor: c.line },
                  ]}
                >
                  <View style={s.cardCaption}>
                    <Text style={[s.micro, muted]}>● YOUR QUANTA</Text>
                    <Text style={[s.micro, muted]}>TEXT / 01</Text>
                  </View>
                  <Animated.View
                    style={{
                      flex: 1,
                      opacity: motion.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.1],
                      }),
                      transform: [
                        {
                          translateY: motion.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -70],
                          }),
                        },
                      ],
                    }}
                  >
                    <TextInput
                      ref={input}
                      style={[s.input, body]}
                      multiline
                      textAlignVertical="top"
                      value={draft}
                      onChangeText={setDraft}
                      accessibilityLabel="Quanta text"
                      placeholder=" "
                      selectionColor={c.primary}
                    />
                    {!draft && !attachments.length && (
                      <View pointerEvents="none" style={s.emptyQuanta}>
                        <Orbit color={c.primary} />
                        <Text style={[s.placeholderTitle, body]}>
                          {composerPrompts[prompt]}
                        </Text>
                        <Text style={[s.placeholderHint, muted]}>
                          Tap here and let a thought in.
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                  {!!attachments.length && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{
                        flexGrow: 0,
                        maxHeight: 130,
                        borderTopWidth: 1,
                        borderColor: c.line,
                      }}
                      contentContainerStyle={{ padding: 12, gap: 10 }}
                    >
                      {attachments.map((a, i) => (
                        <View
                          key={a.uri ?? i}
                          style={{
                            width: 120,
                            borderRadius: 13,
                            borderWidth: 1,
                            borderColor: c.line,
                            overflow: "hidden",
                            backgroundColor: c.surface,
                          }}
                        >
                          <View
                            style={{
                              height: 64,
                              backgroundColor: c.tint,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {a.mimeType.startsWith("image/") ? (
                              <Image
                                source={{ uri: a.uri }}
                                resizeMode="contain"
                                style={{ width: "100%", height: 64 }}
                              />
                            ) : (
                              <Paperclip color={c.primary} size={23} />
                            )}
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[s.footerText, body, { padding: 8 }]}
                          >
                            {a.name}
                          </Text>
                          <Pressable
                            accessibilityLabel={"Remove " + a.name}
                            disabled={busy}
                            onPress={() =>
                              setAttachments((old) =>
                                old.filter((_, n) => n !== i),
                              )
                            }
                            hitSlop={5}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              backgroundColor: c.paper,
                              borderRadius: 15,
                              padding: 5,
                            }}
                          >
                            <X size={13} color={c.ink} />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                  <View style={s.cardFooter}>
                    <Text style={[s.footerText, muted]}>
                      {draft
                        ? draft.length.toLocaleString() + " characters"
                        : ""}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={s.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attach images or files"
                  onPress={() => void attach()}
                  disabled={busy}
                  style={[
                    s.action,
                    { borderColor: c.line, backgroundColor: c.paper },
                  ]}
                >
                  <Paperclip size={23} color={c.primary} />
                  <Text style={[s.actionText, body]}>Attach something</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Paste from clipboard"
                  onPress={() => void paste()}
                  style={[
                    s.action,
                    { borderColor: c.line, backgroundColor: c.paper },
                  ]}
                >
                  <ClipboardIcon size={23} color={c.primary} />
                  <Text style={[s.actionText, body]}>Paste from clipboard</Text>
                </Pressable>
              </View>
            </View>
            {sendLayout === "right" && (
              <SendRail
                c={c}
                ready={
                  (!!draft.trim() || !!attachments.length) &&
                  status === "connected"
                }
                busy={busy}
                onSend={() => void send()}
              />
            )}
            {sendLayout === "under" &&
              (underControl === "slider" ? (
                <SendRail
                  horizontal
                  c={c}
                  ready={
                    (!!draft.trim() || !!attachments.length) &&
                    status === "connected"
                  }
                  busy={busy}
                  onSend={() => void send()}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    busy ||
                    status !== "connected" ||
                    (!draft.trim() && !attachments.length)
                  }
                  onPress={() => void send()}
                  style={({ pressed }) => ({
                    height: 58,
                    borderRadius: 18,
                    backgroundColor: c.primary,
                    opacity: pressed ? 0.65 : 1,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text
                    style={{
                      color: c.onPrimary,
                      fontFamily: "DMSans_600SemiBold",
                    }}
                  >
                    {busy ? "Tunneling…" : "Tunnel"}
                  </Text>
                </Pressable>
              ))}
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {page === "history" && (
              <>
                <View
                  style={[
                    s.segmented,
                    { backgroundColor: c.paper, borderColor: c.line },
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
                            filter === f ? c.tint : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.actionText,
                          { color: filter === f ? c.tintInk : c.muted },
                        ]}
                      >
                        {f[0].toUpperCase() + f.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Search history"
                  placeholder="Find a thought…"
                  placeholderTextColor={c.muted}
                  value={search}
                  onChangeText={setSearch}
                  style={[
                    s.search,
                    body,
                    { borderColor: c.line, backgroundColor: c.paper },
                  ]}
                />
                {results.length ? (
                  results.map((q) => (
                    <View
                      key={q.id}
                      style={[
                        s.historyItem,
                        { backgroundColor: c.paper, borderColor: c.line },
                      ]}
                    >
                      <View style={s.historyMeta}>
                        {q.direction === "sent" ? (
                          <ArrowUpRight size={17} color={c.primary} />
                        ) : (
                          <ArrowDownLeft size={17} color={c.primary} />
                        )}
                        <Text style={[s.meta, muted]}>
                          {q.direction === "sent" ? "To" : "From"} {q.peer} ·{" "}
                          {new Date(q.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                        {iconButton(
                          <Copy size={17} color={c.muted} />,
                          "Copy transfer text",
                          () =>
                            void (
                              q.text
                                ? Clipboard.setStringAsync(q.text)
                                : Promise.reject(
                                    new Error("This quanta contains files."),
                                  )
                            )
                              .then(() => setToast("Copied to clipboard."))
                              .catch(() => setToast("Could not copy.")),
                        )}
                      </View>
                      <Text selectable style={[s.historyText, body]}>
                        {q.text}
                      </Text>
                      {(q.attachments ?? []).map((a, i) => (
                        <View
                          key={i}
                          style={{
                            borderWidth: 1,
                            borderColor: c.line,
                            borderRadius: 16,
                            overflow: "hidden",
                            marginBottom: 12,
                            backgroundColor: c.surface,
                          }}
                        >
                          <Pressable
                            disabled={!a.mimeType.startsWith("image/")}
                            accessibilityLabel={"View " + a.name}
                            onPress={() => setViewImage(a)}
                            style={{
                              height: a.mimeType.startsWith("image/")
                                ? 155
                                : 58,
                              backgroundColor: c.tint,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {a.mimeType.startsWith("image/") ? (
                              <Image
                                source={{ uri: a.uri }}
                                resizeMode="contain"
                                style={{ width: "100%", height: 155 }}
                              />
                            ) : (
                              <Paperclip color={c.primary} />
                            )}
                          </Pressable>
                          <View style={{ padding: 12 }}>
                            <Text
                              numberOfLines={2}
                              style={[s.actionText, body]}
                            >
                              {a.name}
                            </Text>
                            <Text
                              style={[s.footerText, muted, { marginTop: 5 }]}
                            >
                              {(a.size / 1048576).toFixed(2)} MB
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              borderTopWidth: 1,
                              borderColor: c.line,
                            }}
                          >
                            <Pressable
                              accessibilityLabel={"Save " + a.name}
                              onPress={() =>
                                void saveFile(a)
                                  .then(() => setToast("Saved " + a.name))
                                  .catch((e) => setToast(e.message))
                              }
                              style={{
                                flex: 1,
                                minHeight: 48,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                style={[s.actionText, { color: c.primary }]}
                              >
                                Save
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityLabel={"Share " + a.name}
                              onPress={() =>
                                void shareFile(a).catch((e) =>
                                  setToast(e.message),
                                )
                              }
                              style={{
                                flex: 1,
                                minHeight: 48,
                                alignItems: "center",
                                justifyContent: "center",
                                borderLeftWidth: 1,
                                borderColor: c.line,
                              }}
                            >
                              <Text
                                style={[s.actionText, { color: c.primary }]}
                              >
                                Share
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      <View style={s.historyMeta}>
                        <CheckCheck
                          size={13}
                          color={q.status === "failed" ? c.error : c.primary}
                        />
                        <Text
                          style={[
                            s.footerText,
                            {
                              color: q.status === "failed" ? c.error : c.muted,
                            },
                          ]}
                        >
                          {q.status === "delivered"
                            ? "Received"
                            : q.status === "pending"
                              ? "Awaiting receipt"
                              : "Receipt unconfirmed"}
                        </Text>
                        {q.status === "failed" && q.direction === "sent" && (
                          <Pressable
                            accessibilityRole="button"
                            disabled={busy || status !== "connected"}
                            onPress={() => void send(q)}
                            style={s.retry}
                          >
                            <RefreshCw size={14} color={c.primary} />
                            <Text style={[s.footerText, { color: c.primary }]}>
                              Retry
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={[s.emptyPage, { borderColor: c.line }]}>
                    <History size={36} color={c.primary} />
                    <Text style={[s.sectionTitle, body]}>
                      {search
                        ? "No matching quanta."
                        : "Your thoughts will leave a trail."}
                    </Text>
                    <Text style={[s.subtitle, muted]}>
                      Sent and received quanta will appear here.
                    </Text>
                  </View>
                )}
                <Text style={[s.sendHint, muted]}>
                  The latest 200 transfers. Stored on this device.
                </Text>
                {!!history.length && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
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
                      )
                    }
                    style={s.textButton}
                  >
                    <Text style={[s.actionText, { color: c.muted }]}>
                      Clear history
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            {page === "devices" && (
              <>
                <View
                  style={[
                    s.panel,
                    { backgroundColor: c.paper, borderColor: c.line },
                  ]}
                >
                  <Text style={[s.sectionTitle, body]}>This phone’s name</Text>
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
                    {credentials ? "YOUR LINKED DESKTOP" : "OPEN A TUNNEL"}
                  </Text>
                  {credentials ? (
                    <>
                      <View style={s.linkedDevice}>
                        <Link2 size={34} color={c.primary} />
                        <Text style={[s.sectionTitle, body]}>
                          {credentials.desktopName}
                        </Text>
                        <Text style={[s.subtitle, muted]}>
                          {status === "connected"
                            ? "Linked and ready."
                            : "Keep your desktop and phone on the same Wi-Fi."}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={unlink}
                        style={[s.softButton, { backgroundColor: c.tint }]}
                      >
                        <Unplug size={17} color={c.tintInk} />
                        <Text style={[s.actionText, { color: c.tintInk }]}>
                          Unlink desktop
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={[s.sectionTitle, body]}>
                        Scan. Link. Tunnel.
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
                      <Text style={[s.footerText, muted]}>
                        Or paste the pairing JSON
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
                  )}
                </View>
                <View style={s.privacyNote}>
                  <ShieldCheck size={19} color={c.primary} />
                  <Text style={[s.subtitle, muted]}>
                    Direct across your local network.{"\n"}Encrypted between
                    your devices.
                  </Text>
                </View>
                <Text style={[s.sendHint, muted]}>
                  Tunnel stays connected in the background on Android.
                </Text>
              </>
            )}
            {page === "settings" && (
              <>
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
                    {(["left", "right", "under"] as const).map((position) => (
                      <Pressable
                        key={position}
                        onPress={() =>
                          void saveLocal("tunnel-send-layout", position)
                            .then(() => setSendLayout(position))
                            .catch(() => setToast("Could not save layout."))
                        }
                        style={[
                          s.segment,
                          {
                            backgroundColor:
                              sendLayout === position ? c.tint : "transparent",
                          },
                        ]}
                      >
                        <Text style={[s.actionText, body]}>
                          {position[0].toUpperCase() + position.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {sendLayout === "under" && (
                    <View style={s.segmented}>
                      {(["slider", "button"] as const).map((control) => (
                        <Pressable
                          key={control}
                          onPress={() =>
                            void saveLocal("tunnel-under-control", control)
                              .then(() => setUnderControl(control))
                              .catch(() => setToast("Could not save control."))
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
                    Shared quanta tunnel in the background. Turn off to review
                    and add a note first.
                  </Text>
                  {(["text", "image", "file"] as const).map((key) => (
                    <View key={key} style={[s.settingRow, { marginTop: 18 }]}>
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
                        onValueChange={(v) => void changeShareSetting(key, v)}
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
                  <View style={s.historyMeta}>
                    <Sparkles size={15} color={c.primary} />
                    <Text style={[s.eyebrow, muted]}>AURORA THEMES</Text>
                  </View>
                  <Text style={[s.sectionTitle, body]}>
                    A softer kind of space.
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
                          setToast("Could not save clipboard preference.");
                        }
                      }}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <View style={[s.bottomBar, { borderColor: c.line }]}>
        <Text style={[s.bottomText, muted]}>LOCAL FIRST. ALWAYS CLOSE.</Text>
        <Text style={[s.bottomText, muted]}>TUNNEL V.01</Text>
      </View>
      <Modal
        visible={menu}
        transparent
        animationType="none"
        onRequestClose={() => setMenu(false)}
      >
        <Pressable style={s.scrim} onPress={() => setMenu(false)}>
          <View
            style={[s.menu, { backgroundColor: c.paper, borderColor: c.line }]}
          >
            <Text style={[s.eyebrow, muted]}>YOUR TUNNEL</Text>
            {navigation.map((n) => (
              <Pressable
                accessibilityRole="button"
                key={n.id}
                onPress={() => navigate(n.id)}
                style={[
                  s.menuItem,
                  { backgroundColor: page === n.id ? c.tint : "transparent" },
                ]}
              >
                <n.icon size={18} color={page === n.id ? c.tintInk : c.ink} />
                <Text
                  style={[
                    s.menuText,
                    { color: page === n.id ? c.tintInk : c.ink },
                  ]}
                >
                  {n.label}
                </Text>
                {page === n.id && <Check size={16} color={c.tintInk} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={scan}
        animationType="slide"
        onRequestClose={() => setScan(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
          <View style={s.scanHeader}>
            <Text style={[s.sectionTitle, body]}>Scan your desktop.</Text>
            {iconButton(<X size={24} color={c.ink} />, "Close scanner", () =>
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
          <Text style={[s.scanHint, muted]}>
            Point at the QR in Tunnel’s Linked devices page.
          </Text>
        </SafeAreaView>
      </Modal>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: arrivalOpacity,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "transparent",
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
      <Modal
        visible={!!viewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewImage(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 20,
            backgroundColor: c.surface,
          }}
        >
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.paper,
              padding: 16,
            }}
          >
            <Pressable
              accessibilityLabel="Close image"
              onPress={() => setViewImage(null)}
              style={{ alignSelf: "flex-end", padding: 12 }}
            >
              <X color={c.ink} />
            </Pressable>
            <Image
              source={{ uri: viewImage?.uri }}
              resizeMode="contain"
              style={{ width: "100%", height: viewport.height * 0.5 }}
            />
            <Text style={[s.actionText, body, { marginVertical: 14 }]}>
              {viewImage?.name}
            </Text>
            <Pressable
              onPress={() =>
                viewImage &&
                void saveFile(viewImage)
                  .then(() => setToast("Image saved."))
                  .catch((e) => setToast(e.message))
              }
              style={[s.softButton, { backgroundColor: c.tint }]}
            >
              <Text style={{ color: c.tintInk }}>Save image</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {!!toast && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            toast +
            (toast.startsWith("Quanta received")
              ? ". View history."
              : ". Dismiss message.")
          }
          accessibilityLiveRegion="polite"
          onPress={() => {
            if (
              toast.startsWith("Quanta received") ||
              toast.startsWith("Received. Copy")
            )
              navigate("history");
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
                : 60,
            },
          ]}
        >
          <Text style={[s.toastText, { color: c.tintInk }]}>{toast}</Text>
          <Pressable
            accessibilityLabel="Dismiss message"
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              setToast("");
            }}
          >
            <X size={15} color={c.tintInk} />
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 69,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontFamily: "DMSans_600SemiBold", fontSize: 27, letterSpacing: -1 },
  iconButton: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  connection: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectionText: { fontSize: 9 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  heading: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  eyebrow: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: "DMSans_500Medium",
    fontSize: 34,
    letterSpacing: -1.5,
    marginTop: 13,
    marginBottom: 10,
  },
  subtitle: { fontSize: 11, lineHeight: 18 },
  sendPage: { flex: 1, paddingHorizontal: 20 },
  composerRow: { flex: 1, flexDirection: "row", gap: 10, minHeight: 215 },
  card: { flex: 1, borderWidth: 1, borderRadius: 21, overflow: "hidden" },
  cardCaption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 21,
    paddingBottom: 15,
  },
  micro: { fontFamily: "DMSans_600SemiBold", fontSize: 8, letterSpacing: 1 },
  input: {
    flex: 1,
    fontSize: 18,
    lineHeight: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyQuanta: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 24,
    lineHeight: 28,
    maxWidth: 210,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  placeholderHint: { fontSize: 10 },
  cardFooter: { padding: 18 },
  footerText: { fontFamily: "DMSans_400Regular", fontSize: 9, lineHeight: 15 },
  actions: { flexDirection: "row", gap: 12, marginTop: 13 },
  action: {
    flex: 1,
    height: 76,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { fontFamily: "DMSans_500Medium", fontSize: 10 },
  soon: {
    position: "absolute",
    right: 10,
    top: 10,
    fontSize: 6,
    letterSpacing: 1,
  },
  sendHint: {
    fontSize: 8,
    textAlign: "center",
    lineHeight: 15,
    marginVertical: 17,
  },
  bottomBar: {
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  bottomText: { fontSize: 7, letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 22 },
  segmented: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    marginVertical: 10,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 12,
    marginBottom: 12,
  },
  historyItem: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    marginBottom: 12,
  },
  historyMeta: { flexDirection: "row", gap: 7, alignItems: "center" },
  meta: { fontSize: 9, flex: 1, lineHeight: 16 },
  historyText: { fontSize: 14, lineHeight: 23, marginTop: 9, marginBottom: 13 },
  retry: {
    marginLeft: "auto",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    padding: 8,
  },
  emptyPage: {
    minHeight: 260,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  sectionTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 30,
    marginTop: 19,
    marginBottom: 10,
  },
  textButton: { alignItems: "center", padding: 15 },
  panel: { borderWidth: 1, borderRadius: 23, padding: 23, marginBottom: 18 },
  linkedDevice: { alignItems: "center", paddingVertical: 28 },
  softButton: {
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  scanButton: {
    borderRadius: 18,
    paddingVertical: 36,
    alignItems: "center",
    gap: 17,
    marginVertical: 25,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    fontSize: 11,
    minHeight: 80,
    maxHeight: 140,
    marginVertical: 12,
  },
  privacyNote: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 7,
  },
  themeRow: { flexDirection: "row", gap: 10, marginVertical: 21 },
  themeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    alignItems: "center",
    gap: 9,
    paddingBottom: 12,
  },
  swatch: {
    height: 65,
    width: "100%",
    borderRadius: 6,
    justifyContent: "flex-end",
    padding: 10,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  settingTitle: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(30,50,40,.2)",
    paddingTop: 95,
    paddingHorizontal: 20,
  },
  menu: { borderWidth: 1, borderRadius: 20, padding: 12 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    gap: 13,
    borderRadius: 11,
    marginTop: 6,
  },
  menuText: { fontFamily: "DMSans_500Medium", fontSize: 12, flex: 1 },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 22,
  },
  scanHint: { fontSize: 12, padding: 25, textAlign: "center", lineHeight: 20 },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 60,
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toastText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    lineHeight: 19,
    flex: 1,
  },
});
