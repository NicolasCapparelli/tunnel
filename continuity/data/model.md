# Data model

## Schema routing index

| Representation | Authority | Producer / consumer |
| --- | --- | --- |
| Quanta, Transfer, Pairing, Credentials, WireMessage | [Shared interfaces and validators](../../packages/shared/src/index.ts) | Mobile client and desktop IPC |
| Native Quanta / Wire | [Rust protocol](../../apps/desktop/src-tauri/src/protocol.rs) | Native server encrypt/decrypt |
| Disk, Runtime, Snapshot, native Transfer/Pairing | [Rust server structs](../../apps/desktop/src-tauri/src/server.rs) | Desktop persistence / IPC |
| Phone persisted keys and boot restoration | [Storage](../../apps/mobile/src/storage.ts) | Mobile startup / application |
| Theme preferences and contract | [Theme](../../packages/shared/src/theme.ts) | Both Aurora providers |

There is no database or migration framework. TypeScript and Rust have parallel boundary representations checked by the [crypto fixture](../../tests/fixtures/crypto.json) and protocol tests.

## Transfers and receipts

A Quanta contains ID, text and creation time as positive integer Unix milliseconds. Text preserves whitespace/Unicode but cannot be all whitespace and is at most 64 KiB UTF-8. Transfer adds sent/received direction, pending/delivered/failed status and peer display name. UUID-like IDs identify retry attempts for one logical transfer; peer labels are presentation, not security identity.

Send starts pending and becomes delivered after acknowledgment or failed after timeout/disconnect. On restore pending entries become failed. Each device keeps the newest 200 history entries; at most 2,000 received IDs survive history clearing for duplicate suppression. Unpair clears pairing-related state/seen IDs. These are bounded windows, not unlimited deduplication guarantees. Clearing a draft happens only after confirmation if the draft still matches the sent value.

## Pairing and wire

Version-1 Pairing carries local ws endpoint, 32-byte hex key, token, expiry, desktop identity and name. Credentials add phone identity/name. QR expiry is enforced on initial pairing; stored credentials can reconnect after it expires. New pairing permits one phone; unlink rotates keys. Wire union has hello, welcome, text, ack, ping and pong. Encrypted frame is lowercase hex: 12-byte nonce followed by authenticated ciphertext/tag. Nonces are random; key material must not enter logs or commits.

## Persistence and preferences

Desktop writes `tunnel.json` in Tauri application data using a temporary file then rename; source intends durable receipt but does not establish full crash/power-loss guarantees. Runtime sender, pending receipts and QR session are memory-only. Phone credentials use `tunnel-link` in SecureStore. AsyncStorage keys include theme, history plus seen IDs, draft, device identity and auto-copy. Restoration validates incoming records, bounds collections and repairs pending status; malformed credentials are removed.

Desktop draft/theme live in WebView localStorage. Theme IDs are mineral/dune/tide; appearance light/dark/system, restored through validated defaults. Phone default auto-copy is true. Stored/transferred text remains locally readable outside SecureStore; deletion means removing local history/draft or credentials, not a remote backup deletion. No cloud backup service exists in Tunnel.
