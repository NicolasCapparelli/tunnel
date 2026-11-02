import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowDownLeft,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { FadeScroll, HoldSurface } from "./DuskPrimitives";
import { pairRows } from "./layout";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import type { Row, SqlExecutor, SqlValue } from "@entanglement/core";
import { useAuroraTokens, nativeColor } from "@aurora/react-native";
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

const endpoint = (process.env.EXPO_PUBLIC_SINGULARITY_ENDPOINT ?? "")
  .trim()
  .replace(/\/$/, "");
const vault: OAuthVault = {
  async read() {
    const raw = await SecureStore.getItemAsync("tunnel-singularity-auth");
    return raw ? (JSON.parse(raw) as OAuthRecord) : null;
  },
  write: (value) =>
    SecureStore.setItemAsync("tunnel-singularity-auth", JSON.stringify(value)),
  clear: () => SecureStore.deleteItemAsync("tunnel-singularity-auth"),
};
function randomBytes(length: number) {
  return Crypto.getRandomBytes(length);
}

function expoExecutor(database: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    async select(sql: string, args: readonly SqlValue[] = []) {
      return database.getAllAsync<Row>(
        sql,
        args.map((value) =>
          typeof value === "bigint" ? Number(value) : value,
        ),
      );
    },
    async execute(sql: string, args: readonly SqlValue[] = []) {
      await database.runAsync(
        sql,
        args.map((value) =>
          typeof value === "bigint" ? Number(value) : value,
        ),
      );
    },
    async transaction<T>(body: () => Promise<T>) {
      let result!: T;
      await database.withTransactionAsync(async () => {
        result = await body();
      });
      return result;
    },
    async dataVersion() {
      const rows = await database.getAllAsync<{ data_version: number }>(
        "PRAGMA data_version",
      );
      return Number(rows[0]?.data_version ?? 0);
    },
    close: () => database.closeAsync(),
  };
}

export default function SingularityPanel({
  accountOnly = false,
  onSettings,
  onTunnel,
}: {
  accountOnly?: boolean;
  onSettings: () => void;
  onTunnel: (text: string) => void;
}) {
  const tokens = useAuroraTokens();
  const c = {
    paper: nativeColor(tokens.surfaceContainer),
    deep: nativeColor(tokens.surfaceContainerLow),
    inset: nativeColor(tokens.surfaceContainerHighest),
    surface: nativeColor(tokens.surface),
    ink: nativeColor(tokens.onSurface),
    muted: nativeColor(tokens.onSurfaceVariant),
    primary: nativeColor(tokens.primary),
    line: nativeColor(tokens.outlineVariant),
    error: nativeColor(tokens.error),
    onPrimary: nativeColor(tokens.onPrimary),
  };
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
  const [createSpace, setCreateSpace] = useState(false);
  const [expanded, setExpanded] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [move, setMove] = useState<{
    item: RawQuanta | SingularityEntry;
    y: number;
  } | null>(null);
  const viewport = useWindowDimensions();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Connecting…");
  const [error, setError] = useState("");
  async function acceptCallback(url: string) {
    try {
      const identity = await completeCloudflareSignIn(endpoint, url, vault);
      setRecord(await vault.read());
      setError(`Signed in as ${identity.email ?? "your Cloudflare account"}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void SecureStore.getItemAsync("tunnel-singularity-auth")
      .then((rawValue) => {
        if (rawValue) setRecord(JSON.parse(rawValue) as OAuthRecord);
      })
      .catch((e) => setError((e as Error).message));
    void Linking.getInitialURL().then((url) => {
      if (url?.startsWith("tunnel://singularity-auth"))
        void acceptCallback(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith("tunnel://singularity-auth")) void acceptCallback(url);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    setRaw([]);
    setSpaces([]);
    setEntries([]);
    setSelectedSpace("");
    setText("");
    setSpaceName("");
    if (!record?.accountId || !endpoint) return;
    let live = true;
    let opened: Awaited<ReturnType<typeof openSingularity>> | null = null;
    void (async () => {
      await getCloudflareAccessToken(endpoint, vault); // Refresh when online; still open the local vault when offline.
      const latest = await vault.read();
      if (!latest?.accountId || !live) return;
      const accountKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        latest.accountId,
      );
      const database = await SQLite.openDatabaseAsync(
        `tunnel-singularity-${accountKey}.sqlite`,
      );
      opened = await openSingularity({
        endpoint,
        session: {
          accessToken: () => getCloudflareAccessToken(endpoint, vault),
        },
        accountId: latest.accountId,
        deviceLabel: "Tunnel Android",
        executor: expoExecutor(database),
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
    const a = runtime.db
      .query(rawQuanta)
      .orderBy("createdAt", { descending: true })
      .watch(setRaw, (e) => setError((e as Error).message));
    const b = runtime.db
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
    const d = runtime.db
      .query(singularityEntries)
      .orderBy("updatedAt", { descending: true })
      .watch(setEntries, (e) => setError((e as Error).message));
    return () => {
      a();
      b();
      d();
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
      setError("Singularity is not configured for this build.");
      return;
    }
    setBusy(true);
    try {
      await Linking.openURL(
        await beginCloudflareSignIn(endpoint, vault, randomBytes),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addRaw() {
    const value = text.trim();
    if (!runtime || !value || busy) return;
    setBusy(true);
    try {
      await runtime.db.write((tx) =>
        tx.put(rawQuanta, {
          id: Crypto.randomUUID(),
          text: value,
          createdAt: Date.now(),
          sourceDevice: "android",
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
    if (!runtime || !name || busy) return;
    setBusy(true);
    const now = Date.now();
    const value = {
      id: Crypto.randomUUID(),
      name,
      description: "",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await runtime.db.write((tx) => tx.put(singularitySpaces, value));
      setSpaceName("");
      setSelectedSpace(value.id);
      setCreateSpace(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addEntry() {
    const value = text.trim();
    if (!runtime || !selectedSpace || !value || busy) return;
    setBusy(true);
    const now = Date.now();
    try {
      await runtime.db.write(async (tx) => {
        await tx.put(singularityEntries, {
          id: Crypto.randomUUID(),
          spaceId: selectedSpace,
          ...singularityEntryContent(value),
          createdAt: now,
          updatedAt: now,
        });
        const space = await tx.get(singularitySpaces, selectedSpace);
        if (space)
          await tx.put(singularitySpaces, { ...space, updatedAt: now });
      });
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function moveTo(spaceId: string) {
    if (!runtime || !move || busy) return;
    const item = move.item;
    setBusy(true);
    try {
      await runtime.db.write(async (tx) => {
        if ("text" in item) {
          await tx.put(singularityEntries, {
            id: item.id,
            spaceId,
            ...singularityEntryContent(item.text),
            createdAt: item.createdAt,
            updatedAt: Date.now(),
          });
          await tx.delete(rawQuanta, item.id);
        } else
          await tx.put(singularityEntries, {
            ...item,
            spaceId,
            updatedAt: Date.now(),
          });
        const space = await tx.get(singularitySpaces, spaceId);
        if (space)
          await tx.put(singularitySpaces, { ...space, updatedAt: Date.now() });
      });
      setMove(null);
      setNotice("Moved to space.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
  const field = {
    backgroundColor: c.inset,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 14,
    color: c.ink,
    padding: 13,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
  } as const;
  const button = (
    label: string,
    action: () => void,
    disabled = false,
    selected = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={action}
      style={{
        minHeight: 48,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: selected ? c.primary : c.deep,
        opacity: disabled ? 0.45 : 1,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: selected ? nativeColor(tokens.onPrimary) : c.ink,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const copy = (value: string) => {
    void Clipboard.setStringAsync(value)
      .then(() => setNotice("Copied."))
      .catch(() => setError("Could not copy."));
  };
  const card = (item: RawQuanta | SingularityEntry) => {
    const value = "text" in item ? item.text : singularityEntryText(item);
    return (
      <HoldSurface
        key={item.id}
        onCopy={() => copy(value)}
        onTunnel={() => onTunnel(value)}
        accent={c.primary}
        onAccent={nativeColor(tokens.onPrimary)}
        style={{
          backgroundColor: c.paper,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.line,
          padding: 14,
          gap: 10,
        }}
      >
        <Text
          selectable
          numberOfLines={8}
          style={{
            color: c.ink,
            fontFamily: "DMSans_400Regular",
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {value}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Move quanta to a space"
            onPress={(e) => setMove({ item, y: e.nativeEvent.pageY })}
            style={{ padding: 8 }}
          >
            <MoreHorizontal size={19} color={c.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand quanta"
            onPress={() => setExpanded({ title: "Quanta", body: value })}
            style={{ padding: 8 }}
          >
            <View style={{ width: 20, height: 20 }}>
              <ArrowUpRight
                size={14}
                color={c.muted}
                style={{ position: "absolute", top: -1, right: -1 }}
              />
              <ArrowDownLeft
                size={14}
                color={c.muted}
                style={{ position: "absolute", bottom: -1, left: -1 }}
              />
            </View>
          </Pressable>
        </View>
      </HoldSurface>
    );
  };
  const selected = spaces.find((space) => space.id === selectedSpace);
  const menuHeight = Math.min(300, 48 + spaces.length * 48);
  const menuTop = move
    ? move.y - menuHeight > 36
      ? move.y - menuHeight
      : Math.min(move.y + 10, viewport.height - menuHeight - 24)
    : 0;
  return (
    <View style={{ flex: 1 }}>
      {accountOnly ? (
        <FadeScroll contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View
            style={{
              backgroundColor: c.deep,
              padding: 18,
              borderRadius: 20,
              gap: 14,
            }}
          >
            <Text
              style={{
                color: c.ink,
                fontFamily: "DMSans_600SemiBold",
                fontSize: 20,
              }}
            >
              {record?.accountId
                ? (record.email ?? "Cloudflare account")
                : "One account. Every device."}
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21 }}>
              {record?.accountId
                ? runtime
                  ? syncLabel
                  : "Opening local data…"
                : "Sign in with Cloudflare to share quanta and spaces across your devices."}
            </Text>
            {record?.accountId
              ? button(
                  "Sign out",
                  () => {
                    setBusy(true);
                    void signOutCloudflare(endpoint, vault)
                      .then(() => {
                        setRuntime(null);
                        setRecord(null);
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  },
                  busy,
                )
              : button(
                  busy ? "Opening sign-in…" : "Sign in with Cloudflare",
                  () => void signIn(),
                  busy,
                  true,
                )}
          </View>
        </FadeScroll>
      ) : (
        <>
          <View style={{ padding: 16, paddingTop: 22, gap: 20 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text
                style={{
                  color: c.ink,
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 28,
                  letterSpacing: -1,
                  flex: 1,
                }}
              >
                Singularity
              </Text>
              {!!record?.accountId && (
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  {runtime ? syncLabel : "Connecting…"}
                </Text>
              )}
            </View>
            {/* Same segmented control as History. */}
            <View
              style={{
                flexDirection: "row",
                padding: 3,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: c.inset,
                borderColor: c.line,
              }}
            >
              {(
                [
                  ["raw", "Quanta"],
                  ["structured", "Spaces"],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: section === key }}
                  onPress={() => {
                    setSection(key);
                    if (key === "structured") setSelectedSpace("");
                    setSearch("");
                    setText("");
                  }}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 10,
                    borderRadius: 9,
                    backgroundColor:
                      section === key ? c.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: section === key ? c.onPrimary : c.muted,
                      fontFamily:
                        section === key
                          ? "DMSans_700Bold"
                          : "DMSans_400Regular",
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!!record?.accountId && (
              <TextInput
                accessibilityLabel="Search Singularity"
                placeholder={
                  selected
                    ? `Search ${selected.name}…`
                    : section === "raw"
                      ? "Search quanta…"
                      : "Search spaces…"
                }
                placeholderTextColor={c.muted}
                value={search}
                onChangeText={setSearch}
                style={[field, { height: 48, paddingVertical: 0 }]}
              />
            )}
          </View>
          <FadeScroll
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              paddingTop: 0,
              gap: 12,
              paddingBottom: 86,
            }}
          >
            {!record?.accountId ? (
              <View style={{ paddingVertical: 24, gap: 16 }}>
                <Text style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}>
                  Sign in from Settings → Account to share quanta across your
                  devices.
                </Text>
                {button("Open Account settings", onSettings)}
              </View>
            ) : section === "raw" ? (
              <>
                {visibleRaw.map(card)}
                {!visibleRaw.length && (
                  <Text style={{ color: c.muted }}>No quanta yet.</Text>
                )}
              </>
            ) : selectedSpace ? (
              <>
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 20,
                  }}
                >
                  {selected?.name}
                </Text>
                {visibleEntries.map(card)}
                {!visibleEntries.length && (
                  <Text style={{ color: c.muted }}>
                    No quanta in this space yet.
                  </Text>
                )}
              </>
            ) : (
              <>
                {/* Space cards are short, so they pair into two columns. */}
                {pairRows(
                  spaces.filter((space) =>
                    `${space.name} ${space.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ),
                  () => true,
                ).map((row) => (
                  <View
                    key={row[0].id}
                    style={{ flexDirection: "row", gap: 12 }}
                  >
                    {row.map((space) => (
                      <Pressable
                        key={space.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedSpace(space.id);
                          setSearch("");
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          backgroundColor: c.paper,
                          padding: 18,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: c.line,
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: c.ink,
                            fontFamily: "DMSans_600SemiBold",
                            fontSize: 17,
                          }}
                        >
                          {space.name}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                          {
                            entries.filter(
                              (entry) => entry.spaceId === space.id,
                            ).length
                          }{" "}
                          quanta
                        </Text>
                      </Pressable>
                    ))}
                    {row.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
                {!spaces.length && (
                  <Text style={{ color: c.muted }}>
                    Create a space to gather your quanta.
                  </Text>
                )}
              </>
            )}
          </FadeScroll>
          {!!record?.accountId && (section === "raw" || !!selectedSpace) && (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 16,
                paddingBottom: 12,
                paddingTop: 8,
                backgroundColor: c.surface,
              }}
            >
              <TextInput
                accessibilityLabel={
                  selectedSpace && section === "structured"
                    ? "Add quanta here"
                    : "A thought for every device"
                }
                placeholder={
                  selectedSpace && section === "structured"
                    ? "Add quanta here"
                    : "A thought for every device"
                }
                placeholderTextColor={c.muted}
                value={text}
                onChangeText={setText}
                style={[field, { flex: 1, height: 52 }]}
                onSubmitEditing={() =>
                  void (section === "raw" ? addRaw() : addEntry())
                }
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save quanta"
                disabled={!runtime || busy || !text.trim()}
                onPress={() => void (section === "raw" ? addRaw() : addEntry())}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !runtime || busy || !text.trim() ? 0.4 : 1,
                }}
              >
                <ArrowUp size={22} color={nativeColor(tokens.onPrimary)} />
              </Pressable>
            </View>
          )}
          {!!record?.accountId &&
            section === "structured" &&
            !selectedSpace && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create space"
                disabled={!runtime}
                onPress={() => setCreateSpace(true)}
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 18,
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  backgroundColor: c.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={24} color={nativeColor(tokens.onPrimary)} />
              </Pressable>
            )}
        </>
      )}
      {!!error && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
          onPress={() => setError("")}
          style={{ padding: 12, backgroundColor: c.deep }}
        >
          <Text accessibilityRole="alert" style={{ color: c.error }}>
            {error}
          </Text>
        </Pressable>
      )}
      {!!notice && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 80,
            alignSelf: "center",
            padding: 12,
            borderRadius: 18,
            backgroundColor: c.primary,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: nativeColor(tokens.onPrimary) }}
          >
            {notice}
          </Text>
        </View>
      )}
      <Modal visible={!!move} transparent onRequestClose={() => setMove(null)}>
        <Pressable
          accessibilityLabel="Close move menu"
          onPress={() => setMove(null)}
          style={{ flex: 1, backgroundColor: "rgba(14,20,28,.15)" }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 20,
              left: Math.max(20, viewport.width - 280),
              top: menuTop,
              maxHeight: menuHeight,
              backgroundColor: c.deep,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 16,
              padding: 8,
              elevation: 12,
            }}
          >
            <Text style={{ color: c.muted, padding: 8, fontSize: 12 }}>
              Move to space
            </Text>
            <FadeScroll>
              {spaces.length ? (
                spaces.map((space) =>
                  button(space.name, () => void moveTo(space.id), busy),
                )
              ) : (
                <Text style={{ color: c.muted, padding: 12 }}>
                  Create a space first.
                </Text>
              )}
            </FadeScroll>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={createSpace || !!expanded}
        transparent
        onRequestClose={() => {
          setCreateSpace(false);
          setExpanded(null);
        }}
      >
        <Pressable
          onPress={() => {
            setCreateSpace(false);
            setExpanded(null);
          }}
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(14,20,28,.72)",
            padding: 20,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: c.deep,
              padding: 20,
              borderRadius: 22,
              maxHeight: "80%",
              gap: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 22,
                  flex: 1,
                }}
              >
                {createSpace ? "New space" : expanded?.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => {
                  setCreateSpace(false);
                  setExpanded(null);
                }}
                style={{ padding: 8 }}
              >
                <X size={22} color={c.ink} />
              </Pressable>
            </View>
            {createSpace ? (
              <>
                <TextInput
                  autoFocus
                  accessibilityLabel="Space name"
                  placeholder="Space name"
                  placeholderTextColor={c.muted}
                  value={spaceName}
                  onChangeText={setSpaceName}
                  style={field}
                  onSubmitEditing={() => void addSpace()}
                />
                {button(
                  "Create space",
                  () => void addSpace(),
                  !spaceName.trim() || busy,
                  true,
                )}
              </>
            ) : (
              <>
                <FadeScroll>
                  <Text
                    selectable
                    style={{
                      color: c.ink,
                      fontFamily: "DMSans_400Regular",
                      fontSize: 17,
                      lineHeight: 26,
                    }}
                  >
                    {expanded?.body}
                  </Text>
                </FadeScroll>
                {button("Copy", () => expanded && copy(expanded.body))}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
