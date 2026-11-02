import { randomFillSync } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { newId } from "@entanglement/core";

// Expo's native bridge is unavailable in Node; use Node's secure generator.
vi.mock("expo-crypto", () => ({ getRandomValues: (array: Uint8Array) => randomFillSync(array) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("generates Entanglement IDs when the mobile runtime has no global crypto", async () => {
  vi.stubGlobal("crypto", undefined);
  expect(() => newId()).toThrow();
  await import("../apps/mobile/src/crypto");
  const ids = Array.from({ length: 20 }, () => newId());
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it("preserves an existing crypto provider and its other APIs", async () => {
  const provider = { getRandomValues: vi.fn(), subtle: {} };
  vi.stubGlobal("crypto", provider);
  await import("../apps/mobile/src/crypto");
  expect(globalThis.crypto).toBe(provider);
  expect(globalThis.crypto.getRandomValues).toBe(provider.getRandomValues);
});
