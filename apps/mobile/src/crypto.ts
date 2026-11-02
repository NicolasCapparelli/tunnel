import { getRandomValues } from "expo-crypto";

// Entanglement uses the Web Crypto random-values API for its internal IDs.
// Hermes needs an explicit bridge to Expo's native secure random generator.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: { getRandomValues }, configurable: true, writable: true,
  });
} else if (typeof globalThis.crypto.getRandomValues !== "function") {
  Object.defineProperty(globalThis.crypto, "getRandomValues", { value: getRandomValues, configurable: true });
}
