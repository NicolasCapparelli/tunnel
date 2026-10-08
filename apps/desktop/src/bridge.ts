import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Pairing, Transfer } from "@tunnel/shared";

export interface Snapshot {
  deviceName: string;
  peerName: string | null;
  connected: boolean;
  addresses: string[];
  history: Transfer[];
  autoCopy: boolean;
  notifications: boolean;
  startup: boolean;
  error: string | null;
}
export const native = isTauri();
const preview: Snapshot = {
  deviceName: "This desktop",
  peerName: null,
  connected: false,
  addresses: [],
  history: [],
  autoCopy: true,
  notifications: true,
  startup: false,
  error: null,
};
export const bridge = {
  snapshot: () =>
    native ? invoke<Snapshot>("snapshot") : Promise.resolve(preview),
  pair: (address: string) =>
    native
      ? invoke<Pairing>("pairing", { address })
      : Promise.reject(
          new Error("Open Tunnel’s desktop app to pair your phone."),
        ),
  send: (text: string, id: string) =>
    native
      ? invoke<void>("send_text", { text, id })
      : Promise.reject(
          new Error("Text transfer is available in the desktop app."),
        ),
  unpair: () => (native ? invoke<void>("unpair") : Promise.resolve()),
  clearHistory: () =>
    native ? invoke<void>("clear_history") : Promise.resolve(),
  preferences: (autoCopy: boolean, notifications: boolean, startup: boolean) =>
    native
      ? invoke<void>("preferences", { autoCopy, notifications, startup })
      : Promise.resolve(),
  readClipboard: () => (native ? readText() : navigator.clipboard.readText()),
  copy: (text: string) =>
    native ? writeText(text) : navigator.clipboard.writeText(text),
  subscribe: async (refresh: () => void, history: () => void) => {
    if (!native) return () => {};
    const stops = await Promise.all([
      listen("tunnel-changed", refresh),
      listen("tunnel-history", history),
    ]);
    return () => stops.forEach((stop) => stop());
  },
};
