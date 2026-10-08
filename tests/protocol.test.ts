import { describe, it, expect, vi, afterEach } from "vitest";
import {
  open,
  seal,
  parsePairing,
  validateText,
  TunnelClient,
  type Credentials,
  type SocketLike,
  type WireMessage,
} from "../packages/shared/src/index";
import fixture from "./fixtures/crypto.json";
import { hexToBytes } from "@noble/ciphers/utils.js";
const pairing = {
  v: 1 as const,
  endpoint: "ws://192.168.1.10:53177/tunnel",
  key: "11".repeat(32),
  token: "22".repeat(16),
  expires: Date.now() + 300000,
  serverId: "server-fixture",
  desktopName: "Desktop",
};
const credentials: Credentials = {
  ...pairing,
  deviceId: "phone-fixture",
  deviceName: "Android",
};
class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  messages: WireMessage[] = [];
  send(data: string) {
    this.messages.push(open(data, pairing.key));
  }
  close() {
    this.onclose?.();
  }
  incoming(message: WireMessage) {
    this.onmessage?.({
      data: seal(message, pairing.key, new Uint8Array(12).fill(9)),
    });
  }
}
afterEach(() => vi.useRealTimers());
describe("encrypted transfer contract", () => {
  it("matches the checked-in Rust interoperability fixture", () => {
    expect(
      seal(
        fixture.message as WireMessage,
        fixture.key,
        hexToBytes(fixture.nonce),
      ),
    ).toBe(fixture.frame);
    expect(open(fixture.frame, fixture.key)).toEqual(fixture.message);
  });
  it("rejects tampered payloads and wrong pairing keys", () => {
    expect(() =>
      open(fixture.frame.slice(0, -2) + "ff", fixture.key),
    ).toThrow();
    expect(() => open(fixture.frame, "33".repeat(32))).toThrow();
  });
  it("validates UTF-8 byte size and preserves exact text", () => {
    expect(() => validateText("🌀".repeat(16384))).not.toThrow();
    expect(() => validateText("🌀".repeat(16384) + "x")).toThrow();
    expect(() => validateText(" \n ")).toThrow();
    const text = "  indented\n日本語  ";
    expect(
      open(
        seal(
          { type: "text", quanta: { id: "quanta-123", text, createdAt: 1 } },
          pairing.key,
          new Uint8Array(12),
        ),
        pairing.key,
      ),
    ).toMatchObject({ quanta: { text } });
  });
  it("only accepts local endpoints and fresh QR codes", () => {
    expect(parsePairing(JSON.stringify(pairing))).toEqual(pairing);
    for (const endpoint of [
      "ws://8.8.8.8:53177/tunnel",
      "https://evil.example",
      "ws://192.168.1.300:53177/tunnel",
    ])
      expect(() =>
        parsePairing(JSON.stringify({ ...pairing, endpoint })),
      ).toThrow();
    expect(() => parsePairing("null")).toThrow();
    expect(() =>
      parsePairing(JSON.stringify({ ...pairing, expires: 1 })),
    ).toThrow(/expired/);
  });
});
describe("receipts and reconnects", () => {
  function setup(receive = async () => {}) {
    const sockets: FakeSocket[] = [];
    const statuses: string[] = [];
    let nonce = 0;
    const client = new TunnelClient({
      credentials,
      random: (n) => new Uint8Array(n).fill(++nonce),
      socket: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
      onStatus: (s) => statuses.push(s),
      onReceive: receive,
    });
    client.start();
    const socket = sockets[0];
    socket.onopen?.();
    socket.incoming({
      type: "welcome",
      serverId: pairing.serverId,
      desktopName: pairing.desktopName,
    });
    return { client, socket, sockets, statuses };
  }
  it("waits for the peer receipt before resolving a send", async () => {
    const { client, socket } = setup();
    await vi.waitFor(() => expect(client.status).toBe("connected"));
    let done = false;
    const send = client
      .send({ id: "quanta-123", text: "A thought", createdAt: 1 })
      .then(() => {
        done = true;
      });
    await Promise.resolve();
    expect(done).toBe(false);
    socket.incoming({ type: "ack", id: "unrelated-id" });
    await Promise.resolve();
    expect(done).toBe(false);
    socket.incoming({ type: "ack", id: "quanta-123" });
    await send;
    expect(done).toBe(true);
    client.stop();
  });
  it("only acknowledges incoming text after persistence succeeds", async () => {
    let finish!: () => void;
    const receive = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    const { client, socket } = setup(receive);
    await vi.waitFor(() => expect(client.status).toBe("connected"));
    socket.incoming({
      type: "text",
      quanta: { id: "quanta-456", text: "Incoming", createdAt: 1 },
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(socket.messages.some((x) => x.type === "ack")).toBe(false);
    finish();
    await vi.waitFor(() =>
      expect(socket.messages.some((x) => x.type === "ack")).toBe(true),
    );
    client.stop();
  });
  it("rejects a send on disconnect and reconnects without sending duplicate text", async () => {
    vi.useFakeTimers();
    const { client, socket, sockets } = setup();
    await Promise.resolve();
    const result = client
      .send({ id: "quanta-789", text: "Draft", createdAt: 1 })
      .catch((e) => e.message);
    socket.close();
    expect(await result).toMatch(/Connection lost/);
    await vi.advanceTimersByTimeAsync(1500);
    expect(sockets).toHaveLength(2);
    expect(sockets[1].messages).toHaveLength(0);
    client.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(sockets).toHaveLength(2);
  });
});
