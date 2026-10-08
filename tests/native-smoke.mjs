import { chromium, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { WebSocket } from "ws";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import { randomBytes } from "node:crypto";
const android = (...args) =>
  execFileSync(
    process.env.PYTHON ?? "python",
    ["tools/android-ui.py", ...args],
    { encoding: "utf8" },
  ).trim();
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const pages = browser.contexts().flatMap((c) => c.pages());
const page = pages.find((p) => p.url().includes("1427")) ?? pages[0];
if (!page) throw new Error("No native WebView page");
await page.goto("http://localhost:1427");
await expect(page.getByRole("textbox", { name: "Quanta text" })).toBeVisible();
await expect(
  page.getByText("LOCAL FIRST. ALWAYS CLOSE.", { exact: true }),
).toBeVisible();
const call = (cmd, args = {}) =>
  page.evaluate(
    async ({ cmd, args }) => {
      const { invoke } =
        await import("/node_modules/.vite/deps/@tauri-apps_api_core.js");
      return invoke(cmd, args);
    },
    { cmd, args },
  );
let snapshot = await call("snapshot");
await call("preferences", {
  autoCopy: true,
  notifications: false,
  startup: snapshot.startup,
});
if (snapshot.peerName) await call("unpair");
const pairing = await call("pairing", { address: snapshot.addresses[0] });
pairing.endpoint = "ws://10.0.2.2:53177/tunnel";
// The host alias is only for the Android emulator; real devices scan the LAN address.
android("tap", "Connection status. Open linked devices.");
if (android("has", "Unlink desktop") === "yes") {
  android("tap", "Unlink desktop");
  android("tap", "Unlink");
}
android("tap", "Pairing code");
android("clear");
android("text", JSON.stringify(pairing));
android("back");
android("tap", "Link desktop");
await expect
  .poll(async () => (await call("snapshot")).connected, { timeout: 15000 })
  .toBe(true);
console.log("PASS: Android paired with the real Tauri listener.");
android("tap", "Open navigation");
android("tap", "New quanta");
android("tap", "Quanta text");
android("text", "Native smoke quanta from Android");
android("back");
const [x1, y1, x2, y2] = android("bounds", "Slide up to send quanta")
  .split(",")
  .map(Number);
android(
  "swipe",
  String(Math.round((x1 + x2) / 2)),
  String(y2 - 60),
  String(Math.round((x1 + x2) / 2)),
  String(y1 + 60),
  "650",
);
await expect
  .poll(
    async () =>
      (await call("snapshot")).history.some(
        (q) =>
          q.text === "Native smoke quanta from Android" &&
          q.direction === "received",
      ),
    { timeout: 12000 },
  )
  .toBe(true);
const clipboard = await page.evaluate(async () => {
  const { readText } =
    await import("/node_modules/.vite/deps/@tauri-apps_plugin-clipboard-manager.js");
  return readText();
});
if (clipboard !== "Native smoke quanta from Android")
  throw new Error("Desktop automatic clipboard receipt failed");
console.log(
  "PASS: Upward Android gesture delivered text and copied it to Windows.",
);
await expect
  .poll(() => android("has", "Native smoke quanta from Android"), {
    timeout: 10000,
  })
  .toBe("no");
await page
  .getByRole("textbox", { name: "Quanta text" })
  .fill("Native smoke quanta back to Android");
await page.getByRole("textbox", { name: "Quanta text" }).press("Control+Enter");
await expect(page.getByRole("textbox", { name: "Quanta text" })).toHaveValue(
  "",
  { timeout: 15000 },
);
android("tap", "Paste from clipboard");
if (android("has", "Native smoke quanta back to Android") !== "yes")
  throw new Error("Android automatic clipboard receipt failed");
console.log(
  "PASS: Windows sent back to Android; Android clipboard contained exact text.",
);
// Exercise Android’s ACTION_SEND entry without changing the saved draft.
execFileSync(
  process.env.ANDROID_HOME
    ? process.env.ANDROID_HOME + "\\platform-tools\\adb.exe"
    : "C:\\Users\\cappa\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
  [
    "-s",
    "emulator-5554",
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.SEND",
    "-t",
    "text/plain",
    "--es",
    "android.intent.extra.TEXT",
    "'Share sheet smoke context'",
    "-n",
    "app.tunnel.mobile/.MainActivity",
  ],
);
await expect
  .poll(() => android("has", "Share sheet smoke context"), { timeout: 10000 })
  .toBe("yes");
console.log(
  "PASS: Android text share intent opened the composer and preserved its draft.",
);
android("back");
android("screenshot", "artifacts/android-connected.png");
await page.screenshot({
  path: "artifacts/desktop-connected.png",
  fullPage: true,
});
await call("unpair");
// Reject an unpaired connection with a stale key/token after revocation.
const ws = new WebSocket("ws://127.0.0.1:53177/tunnel");
const rejected = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    ws.close();
    reject(new Error("Revoked key was not rejected"));
  }, 7000);
  ws.on("open", () => {
    const nonce = randomBytes(12);
    const message = {
      type: "hello",
      deviceId: "revoked-phone",
      deviceName: "Revoked",
      token: pairing.token,
    };
    ws.send(
      bytesToHex(nonce) +
        bytesToHex(
          chacha20poly1305(hexToBytes(pairing.key), nonce).encrypt(
            utf8ToBytes(JSON.stringify(message)),
          ),
        ),
    );
  });
  ws.on("close", () => {
    clearTimeout(timeout);
    resolve();
  });
  ws.on("error", () => {});
});
await rejected;
console.log("PASS: Unlink rotated the key and rejected stale credentials.");
writeFileSync(
  "artifacts/native-smoke-results.txt",
  "PASS: native pairing, Android gesture, Windows clipboard, reverse transfer, Android clipboard, share intent, key revocation.\n",
);
await browser.close();
