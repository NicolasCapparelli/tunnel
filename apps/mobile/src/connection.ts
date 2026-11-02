import { wireQuanta } from "./files";
import { Platform, AppState, PermissionsAndroid } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { fullCrop, type Crop } from "./crop";
import {
  TunnelClient,
  type Quanta,
  type ConnectionStatus,
  type Transfer,
  type Attachment,
} from "@tunnel/shared";

type Options = ConstructorParameters<typeof TunnelClient>[0];
type NativeSnapshot = {
  peers: {
    serverId: string;
    status: ConnectionStatus;
    desktopName?: string;
    error?: string;
  }[];
  inbox: (Quanta & { serverId?: string; peer?: string })[];
  outgoing?: Transfer[];
};
type NativeModule = {
  recognizeText(uri: string, crop: string): Promise<string>;
  saveFile(raw: string): Promise<string>;
  start(raw: string): Promise<void>;
  stop(serverId: string): Promise<void>;
  setDestinations(ids: string[]): Promise<void>;
  send(raw: string): Promise<void>;
  snapshot(): string;
  takeReviewDestination(): string | null;
  shareSettings(): string;
  setShareSettings(raw: string): Promise<void>;
  releaseFiles(uris: string[]): Promise<void>;
  consumeOutgoing(ids: string[]): Promise<void>;
  consume(ids: string[]): Promise<void>;
  addListener(event: string, callback: () => void): { remove(): void };
};
const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NativeModule>("TunnelLink")
    : null;
let permissionRequested = false;
let permissionWork: Promise<unknown> | null = null;
let refreshQueue = Promise.resolve();
export async function recognizePhotoText(
  uri: string,
  crop: Crop = fullCrop,
): Promise<string> {
  if (!native) throw new Error("OCR requires the native Android app.");
  return native.recognizeText(uri, JSON.stringify(crop));
}
export async function setNativeDestinations(ids: string[]) {
  await native?.setDestinations(ids);
}
export function takeReviewDestination() {
  return native?.takeReviewDestination() ?? null;
}
export interface Connection {
  readonly status: ConnectionStatus;
  start(): void;
  stop(): void;
  dispose(): void;
  resume(): void;
  send(q: Quanta): Promise<void>;
}
export type ShareSettings = { text: boolean; image: boolean; file: boolean };
export const defaultShareSettings: ShareSettings = {
  text: true,
  image: false,
  file: false,
};
export function getShareSettings(): ShareSettings {
  return native ? JSON.parse(native.shareSettings()) : defaultShareSettings;
}
export async function saveNativeFile(a: Attachment) {
  if (!native) throw new Error("Saving files currently requires Android.");
  const saved = await native.saveFile(JSON.stringify(a));
  if (!saved) throw new Error("Save cancelled.");
}
export async function releaseNativeFiles(uris: string[]) {
  await native?.releaseFiles(uris);
}
export async function setShareSettings(settings: ShareSettings) {
  await native?.setShareSettings(JSON.stringify(settings));
}
export function createConnection(
  options: Options & {
    onOutgoing?: (q: Transfer) => Promise<void>;
    onStarted?: () => Promise<void>;
  },
): Connection {
  if (!native) {
    const client = new TunnelClient(options);
    return {
      get status() {
        return client.status;
      },
      start: () => client.start(),
      stop: () => client.stop(),
      dispose: () => client.stop(),
      resume: () => client.start(),
      send: async (q) => {
        if (
          (q.attachments ?? []).reduce((n, a) => n + a.size, 0) >
          5 * 1024 * 1024
        )
          throw new Error("Large files require the native Android app.");
        await client.send(await wireQuanta(q));
      },
    };
  }
  let status: ConnectionStatus = "offline";
  let disposed = false;
  const refresh = () => {
    refreshQueue = refreshQueue
      .catch(() => {})
      .then(async () => {
        if (disposed) return;
        const state = JSON.parse(native.snapshot()) as NativeSnapshot;
        const peer = state.peers.find(
          (p) => p.serverId === options.credentials.serverId,
        );
        status = peer?.status ?? "offline";
        options.onStatus(status);
        if (peer?.desktopName) options.onPeerName?.(peer.desktopName);
        if (peer?.error) options.onError?.(peer.error);
        if (AppState.currentState !== "active") return;
        for (const q of [...(state.outgoing ?? [])].reverse()) {
          if (
            !options.onOutgoing ||
            q.serverId !== options.credentials.serverId
          )
            continue;
          await options.onOutgoing({
            ...q,
            direction: "sent",
            peer:
              q.peer ?? peer?.desktopName ?? options.credentials.desktopName,
          });
          if (q.status !== "pending") await native.consumeOutgoing([q.id]);
        }
        for (const q of [...state.inbox].reverse()) {
          if (q.serverId && q.serverId !== options.credentials.serverId)
            continue;
          // Old single-device pending inbox has no source ID; only its migrated peer may consume it.
          if (
            !q.serverId &&
            state.peers[0]?.serverId !== options.credentials.serverId
          )
            continue;
          await options.onReceive(q);
          await native.consume([q.id]);
        }
      })
      .catch((e) => options.onError?.(String(e.message ?? e)));
  };
  const sub = native.addListener("onState", refresh);
  return {
    get status() {
      return status;
    },
    start: () => {
      if (AppState.currentState !== "active") {
        refresh();
        return;
      }
      void (async () => {
        if (Number(Platform.Version) >= 33 && !permissionRequested) {
          permissionRequested = true;
          permissionWork = PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }
        await permissionWork;
        if (disposed) return;
        await native.start(JSON.stringify(options.credentials));
      })()
        .then(() => options.onStarted?.())
        .then(refresh)
        .catch((e) => options.onError?.(String(e.message ?? e)));
    },
    stop: () => {
      void native.stop(options.credentials.serverId).then(refresh);
    },
    dispose: () => {
      disposed = true;
      sub.remove();
    },
    resume: refresh,
    send: (q) =>
      native.send(
        JSON.stringify({ ...q, serverId: options.credentials.serverId }),
      ),
  };
}
