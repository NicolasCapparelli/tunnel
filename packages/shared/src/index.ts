import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "@noble/ciphers/utils.js";

export const MAX_TEXT_BYTES = 64 * 1024;
export const MAX_HISTORY = 200;
export const MAX_ATTACHMENT_BYTES = 250 * 1024 * 1024;
export const MAX_FRAME = 1000000;
export interface Attachment {
  name: string;
  mimeType: string;
  size: number;
  data?: string;
  uri?: string;
}
export interface Quanta {
  id: string;
  text: string;
  createdAt: number;
  attachments?: Attachment[];
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
  | { type: "begin"; quanta: Quanta }
  | { type: "chunk"; id: string; index: number; offset: number; data: string }
  | { type: "end"; id: string }
  | { type: "ack"; id: string }
  | { type: "name"; name: string }
  | { type: "ping" | "pong" };
export function validateText(text: string) {
  if (!text.trim()) throw new Error("Add a little context first.");
  if (utf8ToBytes(text).length > MAX_TEXT_BYTES)
    throw new Error("Keep each quanta under 64 KB.");
}
export function validateAttachments(
  items: Attachment[] = [],
  requireData = false,
) {
  if (!Array.isArray(items) || items.length > 32)
    throw new Error("Attach up to 32 files.");
  let total = 0;
  for (const a of items) {
    if (
      !a ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      utf8ToBytes(a.name).length > 255 ||
      /[\\/\x00-\x1f]/.test(a.name) ||
      typeof a.mimeType !== "string" ||
      a.mimeType.length > 127 ||
      !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(a.mimeType) ||
      !Number.isSafeInteger(a.size) ||
      a.size < 0
    )
      throw new Error("Invalid attachment.");
    total += a.size;
    if (a.data !== undefined) {
      if (
        typeof a.data !== "string" ||
        a.data.length !== 4 * Math.ceil(a.size / 3) ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(a.data)
      )
        throw new Error("Invalid file data.");
      const padding = a.data.endsWith("==") ? 2 : a.data.endsWith("=") ? 1 : 0;
      if ((a.data.length / 4) * 3 - padding !== a.size)
        throw new Error("Invalid file size.");
    } else if (requireData || typeof a.uri !== "string" || !a.uri)
      throw new Error("Attachment data is missing.");
  }
  if (total > MAX_ATTACHMENT_BYTES)
    throw new Error("Keep attachments under 250 MB per quanta.");
}
export function validateQuanta(q: Quanta, requireData = false) {
  if (typeof q.text !== "string" || utf8ToBytes(q.text).length > MAX_TEXT_BYTES)
    throw new Error("Keep text under 64 KB.");
  validateAttachments(q.attachments, requireData);
  if (!q.text.trim() && !q.attachments?.length)
    throw new Error("Add text or an attachment first.");
  if (
    !/^[a-zA-Z0-9-]{8,64}$/.test(q.id) ||
    !Number.isSafeInteger(q.createdAt) ||
    q.createdAt <= 0
  )
    throw new Error("Invalid quanta.");
}
export function validQuanta(q: unknown): q is Quanta {
  try {
    if (!q || typeof q !== "object") return false;
    validateQuanta(q as Quanta);
    return true;
  } catch {
    return false;
  }
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
    frame.length > MAX_FRAME ||
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
    ![
      "hello",
      "welcome",
      "text",
      "begin",
      "chunk",
      "end",
      "ack",
      "name",
      "ping",
      "pong",
    ].includes(message.type)
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
/** Foreground JS fallback is bounded; Windows/Android use disk-backed assemblers. */
export class ChunkReceiver {
  private q?: Quanta;
  private offsets: number[] = [];
  begin(q: Quanta) {
    if (
      this.q ||
      !q.attachments?.length ||
      q.attachments.some((a) => a.data !== undefined || a.uri !== undefined)
    )
      throw new Error("Invalid manifest");
    validateQuanta({
      ...q,
      attachments: q.attachments.map((a) => ({ ...a, uri: "staging" })),
    });
    if (q.attachments.reduce((n, a) => n + a.size, 0) > 5 * 1024 * 1024)
      throw new Error("Large files require native Android.");
    this.q = {
      ...q,
      attachments: q.attachments.map((a) => ({ ...a, data: "" })),
    };
    this.offsets = q.attachments.map(() => 0);
  }
  chunk(id: string, index: number, offset: number, data: string) {
    const q = this.q;
    if (
      !q ||
      q.id !== id ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.offsets.length ||
      offset !== this.offsets[index] ||
      typeof data !== "string" ||
      data.length > 65536 ||
      !data.length ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
      data.length % 4
    )
      throw new Error("Invalid file chunk");
    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    const bytes = (data.length / 4) * 3 - padding;
    const a = q.attachments![index];
    if (offset + bytes > a.size || a.data!.endsWith("="))
      throw new Error("Invalid file length");
    a.data += data;
    this.offsets[index] += bytes;
  }
  end(id: string) {
    const q = this.q;
    if (
      !q ||
      q.id !== id ||
      q.attachments!.some((a, i) => a.size !== this.offsets[i])
    )
      throw new Error("Incomplete file transfer");
    validateQuanta(q, true);
    this.q = undefined;
    this.offsets = [];
    return q;
  }
  reset() {
    this.q = undefined;
    this.offsets = [];
  }
}
export class TunnelClient {
  private incoming = new ChunkReceiver();
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
      onPeerName?: (name: string) => void;
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
            this.options.onPeerName?.(message.desktopName);
            this.heartbeat = setInterval(() => {
              if (Date.now() - this.lastSeen > 25000) socket.close();
              else this.transmit({ type: "ping" });
            }, 10000);
          } else if (message.type === "text") {
            if (!validQuanta(message.quanta))
              throw new Error("Invalid text transfer");
            validateQuanta(message.quanta, true);
            await this.options.onReceive(message.quanta);
            this.transmit({ type: "ack", id: message.quanta.id });
          } else if (message.type === "begin")
            this.incoming.begin(message.quanta);
          else if (message.type === "chunk")
            this.incoming.chunk(
              message.id,
              message.index,
              message.offset,
              message.data,
            );
          else if (message.type === "end") {
            const q = this.incoming.end(message.id);
            await this.options.onReceive(q);
            this.transmit({ type: "ack", id: q.id });
          } else if (message.type === "name") {
            if (!message.name.trim() || utf8ToBytes(message.name).length > 80)
              throw new Error("Invalid device name");
            this.options.onPeerName?.(message.name);
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
      this.incoming.reset();
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
    validateQuanta(q, true);
    if (this.status !== "connected")
      return Promise.reject(
        new Error("Desktop is offline. Your draft is safe."),
      );
    if (this.awaiting.has(q.id))
      return Promise.reject(new Error("Already sending this quanta."));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.awaiting.delete(q.id);
          reject(new Error("No receipt yet. Retry from history."));
        },
        q.attachments?.length ? 300000 : 8000,
      );
      this.awaiting.set(q.id, { resolve, reject, timeout });
      try {
        if (!q.attachments?.length) this.transmit({ type: "text", quanta: q });
        else {
          this.transmit({
            type: "begin",
            quanta: {
              ...q,
              attachments: q.attachments.map((a) => ({
                name: a.name,
                mimeType: a.mimeType,
                size: a.size,
              })),
            },
          });
          q.attachments.forEach((a, index) => {
            for (let cursor = 0; cursor < a.data!.length; cursor += 65536)
              this.transmit({
                type: "chunk",
                id: q.id,
                index,
                offset: (cursor / 4) * 3,
                data: a.data!.slice(cursor, cursor + 65536),
              });
          });
          this.transmit({ type: "end", id: q.id });
        }
      } catch (e) {
        clearTimeout(timeout);
        this.awaiting.delete(q.id);
        reject(e);
      }
    });
  }
}
