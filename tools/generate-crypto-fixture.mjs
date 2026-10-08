import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import { mkdirSync, writeFileSync } from "node:fs";
const key = "11".repeat(32),
  nonce = "22".repeat(12);
const message = {
  type: "text",
  quanta: {
    id: "fixture-quanta-001",
    text: "Hello from the other side 🌀\nSecond line.",
    createdAt: 1791475200000,
  },
};
const frame =
  nonce +
  bytesToHex(
    chacha20poly1305(hexToBytes(key), hexToBytes(nonce)).encrypt(
      utf8ToBytes(JSON.stringify(message)),
    ),
  );
mkdirSync("tests/fixtures", { recursive: true });
writeFileSync(
  "tests/fixtures/crypto.json",
  JSON.stringify({ key, nonce, message, frame }, null, 2) + "\n",
);
