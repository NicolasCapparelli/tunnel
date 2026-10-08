import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "@noble/ciphers/utils.js";

export const MAX_TEXT_BYTES = 64 * 1024;
export const MAX_HISTORY = 200;
export interface Quanta {
  id: string;
  text: string;
  createdAt: number;
}
export interface Transfer extends Quanta {
  direction: "sent" | "received";
  status: "pending" | "delivered" | "failed";
  peer: string;
}
export interface Pairing {
  v: 1;
  endpoint: string;
  key: string;
  token: string;
  expires: number;
  serverId: string;
  desktopName: string;
}
export interface Credentials extends Pairing {
  deviceId: string;
  deviceName: string;
}
export type WireMessage =
  | { type: "hello"; deviceId: string; deviceName: string; token: string }
  | { type: "welcome"; serverId: string; desktopName: string }
  | { type: "text"; quanta: Quanta }
  | { type: "ack"; id: string }
  | { type: "ping" | "pong" };
export function validateText(text: string) {
  if (!text.trim()) throw new Error("Add a little context first.");
  if (utf8ToBytes(text).length > MAX_TEXT_BYTES)
    throw new Error("Keep each quanta under 64 KB.");
}
export function validQuanta(q: unknown): q is Quanta {
  if (!q || typeof q !== "object") return false;
  const x = q as Quanta;
  try {
    validateText(x.text);
  } catch {
    return false;
  }
  return (
    typeof x.id === "string" &&
    /^[a-zA-Z0-9-]{8,64}$/.test(x.id) &&
    Number.isSafeInteger(x.createdAt) &&
    x.createdAt > 0
  );
}
export function parsePairing(
  raw: string,
  now = Date.now(),
  allowExpired = false,
): Pairing {
  let p: Pairing;
  try {
    p = JSON.parse(raw);
  } catch {
    throw new Error("This is not a Tunnel pairing code.");
  }
  if (!p || typeof p !== "object")
    throw new Error("This is not a Tunnel pairing code.");
  const match = /^ws:\/\/((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})\/tunnel$/.exec(
    p.endpoint ?? "",
  );
  const ip = match?.[1].split(".").map(Number);
  const local =
    ip &&
    ip.every((n) => n <= 255) &&
    (ip[0] === 10 ||
      ip[0] === 127 ||
      (ip[0] === 192 && ip[1] === 168) ||
      (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31));
  if (
    p.v !== 1 ||
    !local ||
    Number(match?.[2]) < 1 ||
    Number(match?.[2]) > 65535 ||
    !/^[a-f0-9]{64}$/.test(p.key ?? "") ||
    !/^[a-f0-9]{32}$/.test(p.token ?? "") ||
    typeof p.serverId !== "string" ||
    p.serverId.length > 64 ||
    typeof p.desktopName !== "string" ||
    p.desktopName.length > 80 ||
    !Number.isSafeInteger(p.expires)
  )
    throw new Error("Invalid Tunnel code. Use the QR shown on your desktop.");
  if (!allowExpired && p.expires < now)
    throw new Error("This code expired. Refresh it on your desktop.");
  return p;
}
export function seal(
  message: WireMessage,
  key: string,
  nonce: Uint8Array,
): string {
  if (nonce.length !== 12) throw new Error("Invalid nonce");
  const encrypted = chacha20poly1305(hexToBytes(key), nonce).encrypt(
    utf8ToBytes(JSON.stringify(message)),
  );
  return bytesToHex(nonce) + bytesToHex(encrypted);
}
export function open(frame: string, key: string): WireMessage {
  if (
    frame.length < 56 ||
    frame.length > 270000 ||
    !/^[a-f0-9]+$/.test(frame) ||
    frame.length % 2
  )
    throw new Error("Invalid frame");
  const bytes = hexToBytes(frame);
  const raw = bytesToUtf8(
    chacha20poly1305(hexToBytes(key), bytes.slice(0, 12)).decrypt(
      bytes.slice(12),
    ),
  );
  const message = JSON.parse(raw) as WireMessage;
  if (
    !["hello", "welcome", "text", "ack", "ping", "pong"].includes(message.type)
  )
    throw new Error("Unsupported message");
  return message;
}
export type ConnectionStatus = "offline" | "connecting" | "connected";
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}
/** Transport boundary: a relay can replace the local socket without changing the composer. */
export class TunnelClient {
  private socket?: SocketLike;
  private stopped = true;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private handshake?: ReturnType<typeof setTimeout>;
  private awaiting = new Map<
    string,
    {
      resolve: () => void;
      reject: (e: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private lastSeen = 0;
  private attempts = 0;
  status: ConnectionStatus = "offline";
  constructor(
    private options: {
      credentials: Credentials;
      random: (size: number) => Uint8Array;
      socket: (url: string) => SocketLike;
      onStatus: (status: ConnectionStatus) => void;
      onReceive: (q: Quanta) => Promise<void>;
      onError?: (message: string) => void;
    },
  ) {}
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearTimeout(this.handshake);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
    this.setStatus("offline");
    this.rejectPending();
  }
  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.options.onStatus(status);
  }
  private rejectPending() {
    for (const p of this.awaiting.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error("Connection lost. Retry from history."));
    }
    this.awaiting.clear();
  }
  private transmit(message: WireMessage) {
    this.socket?.send(
      seal(message, this.options.credentials.key, this.options.random(12)),
    );
  }
  private connect() {
    if (this.stopped) return;
    this.setStatus("connecting");
    const c = this.options.credentials;
    const socket = this.options.socket(c.endpoint);
    this.socket = socket;
    this.handshake = setTimeout(() => socket.close(), 8000);
    socket.onopen = () =>
      this.transmit({
        type: "hello",
        deviceId: c.deviceId,
        deviceName: c.deviceName,
        token: c.token,
      });
    // Serialize receive handlers so duplicates cannot race persistence and clipboard writes.
    let processing = Promise.resolve();
    socket.onmessage = (e) => {
      processing = processing
        .then(async () => {
          const message = open(String(e.data), c.key);
          this.lastSeen = Date.now();
          if (this.status !== "connected") {
            if (message.type !== "welcome" || message.serverId !== c.serverId)
              throw new Error("Desktop identity mismatch. Pair again.");
            clearTimeout(this.handshake);
            this.attempts = 0;
            this.setStatus("connected");
            this.heartbeat = setInterval(() => {
              if (Date.now() - this.lastSeen > 25000) socket.close();
              else this.transmit({ type: "ping" });
            }, 10000);
          } else if (message.type === "text") {
            if (!validQuanta(message.quanta))
              throw new Error("Invalid text transfer");
            await this.options.onReceive(message.quanta);
            this.transmit({ type: "ack", id: message.quanta.id });
          } else if (message.type === "ack") {
            const p = this.awaiting.get(message.id);
            if (p) {
              clearTimeout(p.timeout);
              this.awaiting.delete(message.id);
              p.resolve();
            }
          } else if (message.type === "ping") this.transmit({ type: "pong" });
        })
        .catch((error) => {
          this.options.onError?.(String(error.message ?? error));
          socket.close();
        });
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      clearTimeout(this.handshake);
      clearInterval(this.heartbeat);
      this.setStatus("offline");
      this.rejectPending();
      if (!this.stopped)
        this.retry = setTimeout(
          () => this.connect(),
          Math.min(1500 * 2 ** this.attempts++, 15000),
        );
    };
  }
  send(q: Quanta): Promise<void> {
    validateText(q.text);
    if (this.status !== "connected")
      return Promise.reject(
        new Error("Desktop is offline. Your draft is safe."),
      );
    if (this.awaiting.has(q.id))
      return Promise.reject(new Error("Already sending this quanta."));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.awaiting.delete(q.id);
        reject(new Error("No receipt yet. Retry from history."));
      }, 8000);
      this.awaiting.set(q.id, { resolve, reject, timeout });
      try {
        this.transmit({ type: "text", quanta: q });
      } catch (e) {
        clearTimeout(timeout);
        this.awaiting.delete(q.id);
        reject(e);
      }
    });
  }
}
