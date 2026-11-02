import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  validQuanta,
  parsePairing,
  type Credentials,
  type Transfer,
  MAX_HISTORY,
  validateAttachments,
  type Attachment,
} from "@tunnel/shared";
import { restoreDesktops, destinationIds } from "@tunnel/shared/devices";
import { restoreTheme } from "@tunnel/shared/theme";
let queue = Promise.resolve();
export function saveLocal(key: string, value: unknown) {
  const write = queue
    .catch(() => {})
    .then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  queue = write;
  return write;
}
let credentialQueue = Promise.resolve();
export function saveDesktops(links: Credentials[]) {
  const work = credentialQueue
    .catch(() => {})
    .then(async () => {
      await SecureStore.setItemAsync("tunnel-links", JSON.stringify(links));
      await SecureStore.deleteItemAsync("tunnel-link");
    });
  credentialQueue = work;
  return work;
}
export async function load() {
  const [items, link] = await Promise.all([
    AsyncStorage.multiGet([
      "tunnel-theme",
      "tunnel-history",
      "tunnel-draft",
      "tunnel-device",
      "tunnel-device-name",
      "tunnel-auto-copy",
      "tunnel-attachments",
      "tunnel-send-layout",
      "tunnel-under-control",
      "tunnel-destinations",
    ]),
    Promise.all([
      SecureStore.getItemAsync("tunnel-links"),
      SecureStore.getItemAsync("tunnel-link"),
    ]),
  ]);
  const parse = (key: string) => {
    try {
      return JSON.parse(items.find((x) => x[0] === key)?.[1] ?? "null");
    } catch {
      return null;
    }
  };
  let rawLinks: unknown = null;
  try {
    rawLinks = JSON.parse(link[0] ?? link[1] ?? "null");
  } catch {}
  const links = restoreDesktops(rawLinks);
  if (link[1] && !link[0]) await saveDesktops(links);
  const credentials = links[0] ?? null;
  const storedHistory = parse("tunnel-history");
  const rawHistory = Array.isArray(storedHistory)
    ? storedHistory
    : storedHistory?.items;
  const history: Transfer[] = Array.isArray(rawHistory)
    ? rawHistory
        .filter(
          (q: Transfer) =>
            q &&
            ["sent", "received"].includes(q.direction) &&
            ["pending", "failed", "delivered"].includes(q.status) &&
            typeof q.peer === "string" &&
            validQuanta(q),
        )
        .slice(0, MAX_HISTORY)
        .map((q) => ({
          ...q,
          status: q.status === "pending" ? "failed" : q.status,
        }))
    : [];
  const deviceId =
    typeof parse("tunnel-device") === "string"
      ? parse("tunnel-device")
      : Crypto.randomUUID();
  await saveLocal("tunnel-device", deviceId);
  const seen: string[] = Array.isArray(storedHistory?.seen)
    ? storedHistory.seen
        .filter((id: unknown) => typeof id === "string")
        .slice(-2000)
    : history.filter((q) => q.direction === "received").map((q) => q.id);
  return {
    theme: restoreTheme(parse("tunnel-theme")),
    credentials,
    links,
    destinations: destinationIds(
      links,
      parse("tunnel-destinations") ?? (links[0] ? [links[0].serverId] : []),
    ),
    history,
    seen,
    draft:
      typeof parse("tunnel-draft") === "string" ? parse("tunnel-draft") : "",
    deviceId,
    deviceName:
      typeof parse("tunnel-device-name") === "string"
        ? parse("tunnel-device-name")
        : (credentials?.deviceName ??
          (Platform.OS === "android" ? "My Android" : "My iPhone")),
    attachments: (() => {
      const items = parse("tunnel-attachments") ?? [];
      try {
        validateAttachments(items);
        return items as Attachment[];
      } catch {
        return [];
      }
    })(),
    sendLayout: (["right", "left", "under"].includes(
      parse("tunnel-send-layout"),
    )
      ? parse("tunnel-send-layout")
      : "right") as "right" | "left" | "under",
    underControl: (parse("tunnel-under-control") === "button"
      ? "button"
      : "slider") as "button" | "slider",
    autoCopy: parse("tunnel-auto-copy") !== false,
  };
}
export type BootState = Awaited<ReturnType<typeof load>>;
