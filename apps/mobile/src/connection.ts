import { wireQuanta } from "./files";
import { Platform, AppState, PermissionsAndroid } from "react-native";
import { requireOptionalNativeModule } from "expo";
import {
  TunnelClient,
  type Quanta,
  type ConnectionStatus,
  type Transfer,
  type Attachment,
} from "@tunnel/shared";

type Options = ConstructorParameters<typeof TunnelClient>[0];
type NativeSnapshot = {
  status: ConnectionStatus;
  desktopName?: string;
  inbox: Quanta[];
  outgoing?: (Quanta & { status: Transfer["status"] })[];
  error?: string;
};
type NativeModule = {
  saveFile(raw: string): Promise<string>;
  start(raw: string): Promise<void>;
  stop(): Promise<void>;
  send(raw: string): Promise<void>;
  snapshot(): string;
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
  options: Options & { onOutgoing?: (q: Transfer) => Promise<void> },
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
  let queue = Promise.resolve();
  let disposed = false;
  const refresh = () => {
    queue = queue
      .catch(() => {})
      .then(async () => {
        if (disposed) return;
        const state = JSON.parse(native.snapshot()) as NativeSnapshot;
        status = state.status;
        options.onStatus(status);
        if (state.desktopName) options.onPeerName?.(state.desktopName);
        if (state.error) options.onError?.(state.error);
        if (AppState.currentState !== "active") return;
        for (const q of [...(state.outgoing ?? [])].reverse()) {
          if (!options.onOutgoing) continue;
          await options.onOutgoing({
            ...q,
            direction: "sent",
            peer: state.desktopName ?? options.credentials.desktopName,
          });
          if (q.status !== "pending") await native.consumeOutgoing([q.id]);
        }
        for (const q of [...state.inbox].reverse()) {
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
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }
        await native.start(JSON.stringify(options.credentials));
      })()
        .then(refresh)
        .catch((e) => options.onError?.(String(e.message ?? e)));
    },
    stop: () => {
      void native.stop().then(refresh);
    },
    dispose: () => {
      disposed = true;
      sub.remove();
    },
    resume: refresh,
    send: (q) => native.send(JSON.stringify(q)),
  };
}
