# Implementation map

## Setup and resumption

Requests: get this running, rebuild, return after a break, move checkout. Start [setup commands](../developer/setup.md#local-commands) and [stopping point](../status.md#active-work-and-last-stopping-point). Build owner: [desktop helper](../../tools/desktop.ps1); phone owner: [Android helper](../../tools/android.ps1). Verify through [automated commands](../developer/setup.md#automated-verification). Build outputs and dependencies are excluded from source orientation.

## Composer and gestures

Requests: type/paste, slide up, send animation, keep draft. UI owners: [desktop App send/paste](../../apps/desktop/src/App.tsx), [phone TunnelApp send/share intent](../../apps/mobile/src/TunnelApp.tsx). Gesture owner: [native rail](../../apps/mobile/src/SendRail.tsx); shared prompt/momentum/name bounds: [composer helpers](../../packages/shared/src/composer.ts). Desktop App owns the Tunnel button/Ctrl+Enter, persistent sidebar and recent-history panel. Verify [UI tests](../../tests/ui/composer.spec.ts) only with authorized UI testing; typecheck always allowed. Follow [transfers](../data/model.md#transfers-and-receipts), [transport](#transport-and-crypto) for receipt failures and [appearance](#appearance-and-accessibility) for visuals.

## Pairing and linked devices

Requests: scan QR, link phone, pairing expiry, unlink. Server authority: [pairing/unpair/connection](../../apps/desktop/src-tauri/src/server.rs); phone camera/parse consumer: [TunnelApp](../../apps/mobile/src/TunnelApp.tsx). Boundary: [parsePairing](../../packages/shared/src/index.ts). Verify [protocol tests](../../tests/protocol.test.ts); physical QR scan is [pending](../status.md#pending-human-checks). Model: [pairing/wire](../data/model.md#pairing-and-wire). Dependencies: [transport](#transport-and-crypto), [storage](#storage-and-history).

## Storage and history

Requests: recent transfers, search/filter/copy, retry, duplicates, clear history, lost draft. Native owner: [Runtime save/add/send_text/receive](../../apps/desktop/src-tauri/src/server.rs); phone restore: [storage load/saveLocal](../../apps/mobile/src/storage.ts); native pending inbox/seen IDs and protected credentials: [LinkStore](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/LinkStore.kt); phone mutation/display: [TunnelApp](../../apps/mobile/src/TunnelApp.tsx). [Model](../data/model.md#persistence-and-preferences) establishes stores and retention. Verify typecheck plus [receipt/dedup tests](../../tests/protocol.test.ts); UI history and clipboard checks need authorization. Receipt problems follow [transport](#transport-and-crypto).

## Desktop lifecycle and system integration

Requests: tray persistence, close window, notification click, clipboard, login, keyboard shortcut. Lifecycle owner: [main setup/window/tray handlers](../../apps/desktop/src-tauri/src/main.rs); system receipt owner: [server notification/receive/preferences](../../apps/desktop/src-tauri/src/server.rs); standalone notification identity: [Windows helper](../../apps/desktop/src-tauri/src/notifications.rs). Frontend IPC owner: [bridge](../../apps/desktop/src/bridge.ts). Verify Rust build/tests; OS actions remain [pending human checks](../status.md#pending-human-checks). Dependencies: [storage](#storage-and-history), [transport](#transport-and-crypto).

## Phone lifecycle and sharing

Requests: receive from share sheet, background/resume, camera permissions, haptics. Provider owner: [mobile App](../../apps/mobile/App.tsx); lifecycle/share consumer: [TunnelApp effects](../../apps/mobile/src/TunnelApp.tsx); native module config: [app.json](../../apps/mobile/app.json), [Direct Share plugin](../../apps/mobile/plugins/with-tunnel.cjs). Background connection owner: [Expo module](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/TunnelLinkModule.kt) and [service](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/TunnelService.kt), routed through [connection adapter](../../apps/mobile/src/connection.ts). Android Back is in TunnelApp. Verify typecheck/Hermes export; native interaction uses [smoke script](../../tests/native-smoke.mjs) only when authorized. Details: [architecture constraints](../developer/architecture.md#constraints-and-extension-boundaries). Dependencies: [transport](#transport-and-crypto), [storage](#storage-and-history).

## Transport and crypto

Requests: LAN connection, no receipt, corruption, retry/reconnect, heartbeat, future cellular. Phone protocol owner: [TunnelClient/seal/open](../../packages/shared/src/index.ts); native crypto owners: [Rust protocol](../../apps/desktop/src-tauri/src/protocol.rs) and [Android LinkCrypto](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/LinkCrypto.kt), with [JVM interoperability tests](../../apps/mobile/modules/tunnel-link/android/src/test/java/app/tunnel/link/LinkCryptoTest.kt); native socket/session owner: [serve/connection](../../apps/desktop/src-tauri/src/server.rs). Verify [shared tests](../../tests/protocol.test.ts), Rust inline tests and [cross-language fixture](../../tests/fixtures/crypto.json). Details: [delivery flow](../developer/architecture.md#pairing-and-delivery), [wire model](../data/model.md#pairing-and-wire). Persistence failure needs [storage](#storage-and-history).

## Appearance and accessibility

Requests: Aurora, softer dark surfaces, colors, fonts, reduced motion, screen reader. Read [design](../design/README.md) first. Runtime authority: [shared contract/themes](../../packages/shared/src/theme.ts); web mapping: [main provider](../../apps/desktop/src/main.tsx) and [CSS](../../apps/desktop/src/style.css); native mapping: [App provider](../../apps/mobile/App.tsx) and [TunnelApp token consumer](../../apps/mobile/src/TunnelApp.tsx). Verify [theme tests](../../tests/theme.test.ts), typecheck; visual/interaction assessment stays with user. [Integration](../design/integrations.md) owns vendor refresh. Gesture accessibility follows [composer](#composer-and-gestures).

## Changes and future intent

Requests: what changed, what should I test: [implementation log](../implementation-log.md), [pending checks](../status.md#pending-human-checks), [historical evidence](../../docs/verification.md). Requests: what next, brainstorm, later features: [roadmap](../planning/roadmap.md), [ideas](../planning/ideas.md). These describe authorization and intent; they do not grant permission to implement new scope.

## Exclusions and uncertainty

Exclude node_modules, target, .tools, generated Android/iOS, test-results and vendor contents during ordinary orientation. Vendor runtime is intentionally tracked despite being built dist; inspect only for integration issues. No accounts/backend exists yet. Root AGENTS.md is the only project-owned agent discovery file found; dependency/vendor documents serve their own external scopes and were not edited.

## Files, images and instant shares

Requests: attach files, preview/save images, optional notes, selected-text Tunnel, background text shares, per-type share settings. Protocol/schema: [shared validation](../../packages/shared/src/index.ts), [Rust protocol](../../apps/desktop/src-tauri/src/protocol.rs). Desktop send/storage/save/preview: [server](../../apps/desktop/src-tauri/src/server.rs), [bridge](../../apps/desktop/src/bridge.ts), [App](../../apps/desktop/src/App.tsx). Phone import/export: [files](../../apps/mobile/src/files.ts), [native LinkFiles](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/LinkFiles.kt). Native intake: [ShareActivity](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/ShareActivity.kt), [manifest](../../apps/mobile/modules/tunnel-link/android/src/main/AndroidManifest.xml), [plugin](../../apps/mobile/plugins/with-tunnel.cjs). Settings/outbox: [module](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/TunnelLinkModule.kt), [LinkStore](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/LinkStore.kt), [service](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/TunnelService.kt) and [UI](../../apps/mobile/src/TunnelApp.tsx). Verify [attachment boundaries](../../tests/attachments.test.ts) and [binary fixture](../../tests/fixtures/attachment.json), typechecks/native builds. Device selection-menu/background/file picker/export checks remain user-owned.

Chunk streaming/staging owners: [Rust Incoming](../../apps/desktop/src-tauri/src/stream.rs) and [Android IncomingFiles](../../apps/mobile/modules/tunnel-link/android/src/main/java/app/tunnel/link/IncomingFiles.kt). Native module owns Android save-to-MediaStore/document-picker; desktop server owns file/image clipboard and lazy thumbnail IPC. Mobile layout preferences are in storage/TunnelApp, gesture completion in SendRail. Next-network discussion: [routing proposal](../planning/network-transfers.md), currently planning only.
