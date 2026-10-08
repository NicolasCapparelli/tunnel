# Architecture

## Components

[Desktop entry](../../apps/desktop/src/main.tsx) hosts React in a Tauri WebView with Aurora's web provider. [Bridge](../../apps/desktop/src/bridge.ts) separates native IPC from an explicitly limited browser preview. [Native main](../../apps/desktop/src-tauri/src/main.rs) owns tray, window lifecycle, shortcut, startup and listener startup. [Server](../../apps/desktop/src-tauri/src/server.rs) owns pairing, disk state, sockets, receipts, clipboard and native notifications independently of WebView visibility.

[Mobile entry](../../apps/mobile/App.tsx) loads fonts/storage and wraps Aurora, safe-area and share-intent providers. [Mobile application](../../apps/mobile/src/TunnelApp.tsx) owns navigation, foreground lifecycle, camera pairing, history and clipboard. [Shared client](../../packages/shared/src/index.ts) owns validation, encrypted frames, handshake, heartbeat, reconnect and receipt timeouts. React Native uses Expo native modules; desktop uses React DOM, not React Native inside Tauri.

## Pairing and delivery

Desktop creates an expiring QR with endpoint, server ID, shared key and pairing token. The phone validates a local IPv4 endpoint and performs an encrypted hello. The server binds one phone identity; subsequent reconnects retain credentials. Unlink rotates the key and disconnects. This is device pairing rather than account authentication.

Text is validated, assigned a stable ID, encrypted with ChaCha20-Poly1305 and sent over a local WebSocket. Receipt follows receive persistence. UI clears an unchanged draft only after confirmation. Retry retains the original ID; bounded seen-ID storage suppresses duplicate side effects. Receipt timeout indicates uncertainty, not proof of nondelivery. Desktop handles clipboard and notification errors without discarding received history. Mobile serializes persistence before receipt. See [model](../data/model.md).

## Constraints and extension boundaries

The native listener remains in the tray; Android stops its connection in background and reconnects on resume. Desktop toast activation opens history on Windows; other platforms need separate implementation/verification. One paired phone, text/links, bounded history and local IPv4 are V1 constraints. No automatic offline queue or continuous clipboard monitoring exists.

Phone keys use SecureStore; history/draft use AsyncStorage. Desktop state including keys is local-user-readable JSON; no application encryption at rest. There is no backend, analytics or account requirement. The shared client's socket interface is the future remote-transport seam, but relay authentication/discovery are not implemented. [Aurora integration](../design/integrations.md) is shared across the two renderers.
