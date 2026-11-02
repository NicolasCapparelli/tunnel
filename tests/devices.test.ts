import { describe, expect, it } from "vitest";
import {
  restoreDesktops,
  upsertDesktop,
  destinationIds,
  recipientTransfers,
} from "../packages/shared/src/devices";
import type { Credentials, Quanta } from "../packages/shared/src/index";
const peer = (id: string): Credentials => ({
  v: 1,
  serverId: id,
  desktopName: id,
  endpoint: "ws://192.168.1.10:53177/tunnel",
  key: "11".repeat(32),
  token: "22".repeat(16),
  expires: 1,
  deviceId: "phone",
  deviceName: "Android",
});
describe("desktop registry and explicit delivery routes", () => {
  it("migrates an expired single pairing without losing its identity or key", () => {
    expect(restoreDesktops(peer("Windows"))).toEqual([peer("Windows")]);
  });
  it("recovers valid peers independently of malformed registry entries", () => {
    expect(
      restoreDesktops([
        peer("Windows"),
        null,
        { ...peer("broken"), key: "invalid" },
        peer("Mac"),
        peer("Windows"),
      ]).map((p) => p.serverId),
    ).toEqual(["Windows", "Mac"]);
  });
  it("re-pairing one desktop preserves the other desktop's key", () => {
    const windows = peer("Windows"),
      mac = peer("Mac"),
      next = { ...windows, key: "33".repeat(32) };
    expect(upsertDesktop([windows, mac], next)).toEqual([next, mac]);
  });
  it("rejects excess pairings without evicting existing desktops", () => {
    const peers = Array.from({ length: 8 }, (_, i) => peer(String(i)));
    expect(() => upsertDesktop(peers, peer("new"))).toThrow("eight");
    expect(peers).toHaveLength(8);
  });
  it("removing a desktop cannot redirect its selected destination to another", () => {
    expect(
      destinationIds([peer("Mac")], ["Windows", "Mac", "Mac", "unknown"]),
    ).toEqual(["Mac"]);
    expect(destinationIds([peer("Mac")], ["Windows"])).toEqual([]);
  });
  it("fans out notes and attachment references with independent recipient receipt IDs", () => {
    const q: Quanta = {
      id: "draft",
      text: "note",
      createdAt: 42,
      attachments: [
        {
          name: "image.png",
          mimeType: "image/png",
          size: 20,
          uri: "file:///private/image.png",
        },
      ],
    };
    let seq = 0;
    const batch = recipientTransfers(
      q,
      [peer("Windows"), peer("Mac")],
      ["Windows", "Mac"],
      () => `receipt-${++seq}`,
    );
    expect(batch.map((t) => [t.id, t.serverId, t.peer, t.status])).toEqual([
      ["receipt-1", "Windows", "Windows", "pending"],
      ["receipt-2", "Mac", "Mac", "pending"],
    ]);
    expect(
      batch.every((t) => t.text === q.text && t.attachments === q.attachments),
    ).toBe(true);
    expect(q.id).toBe("draft");
  });
  it("never implicitly sends to the first peer when no destination is selected", () => {
    expect(() =>
      recipientTransfers(
        { id: "q", text: "secret", createdAt: 1 },
        [peer("Windows")],
        [],
        () => "id",
      ),
    ).toThrow("Choose");
  });
});
