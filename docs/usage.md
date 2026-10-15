# Detailed usage and engineering notes

For the project overview and quick start, see the [README](../README.md). This guide preserves the detailed interaction and implementation notes. Multi-desktop routing and the macOS dispatcher described here are local, uncommitted development work; the documentation-only publication does not include that runtime code. See the README published-code boundary.

A private passage for text, images and files between your Android phone and linked desktops. React + Tauri on desktop, React Native + Expo on mobile, with a shared Aurora contract and encrypted transfer protocol.

The default **Mineral** theme uses soft sage surfaces and teal. **Dune** and **Tide**, plus light/dark/system appearance, are available on both devices. Dark variants use slate surfaces. Theme changes preserve navigation and drafts.

## Run locally

Work from `your local Tunnel checkout`. Build/run commands and prerequisites are maintained in [Continuity setup](../continuity/developer/setup.md). Local native builds are the current workflow; installers and distribution packaging are disabled.

Install and open Tunnel on both devices, on the same Wi-Fi. On Windows, open **Linked devices**, create a QR code, then scan it from Android’s **Linked devices** page. Codes expire after five minutes. Windows lets you choose a network address if there are multiple adapters; select the Wi-Fi/LAN address the phone can reach.

If camera scanning is unavailable, **Copy pairing code** on Windows supplies the JSON accepted by the Android pairing form.

If Windows prompts about network access, allow Tunnel on your private network. The desktop listens on TCP **53177**. Guest Wi-Fi and networks with client isolation can block device-to-device connections. Internet/cellular transfer is not implemented yet.

Type or paste into the large composer. On Android, flick upward on the rail or pass two particles; the handle completes its motion and sends. On desktop, use **Tunnel** or **Ctrl+Enter** anywhere on the composer page. In mobile Appearance settings, place the rail Left, Right or Under; Under can instead use a Tunnel button. The rail completes with a burst, then resets invisibly to its starting position. Short gestures cancel. Screen-reader users have a send action. The draft clears after all selected desktops confirm receipt. Partial success keeps the draft; retry only failed recipient entries in history to avoid resending to successful recipients. A changed draft is preserved if you keep typing while sending.

Incoming text and single-image quanta copy to the Windows clipboard by default; phone auto-copy applies to text while active. Switch this off in settings. Windows sends a notification; its activation callback opens history. Notifications contain a generic receipt rather than the transferred text. Closing the Windows window hides it in the tray. The tray menu has Open, History, and Quit. **Ctrl+Shift+Space** opens Tunnel, and launch at login is an optional setting.

Android text/URL shares and the selected-text **Tunnel** action send through native code without opening the main UI by default. Shared images/files open the composer for an optional note. **Share straight away** settings choose instant or review behavior independently for text, images and other files. Android and the source app choose text-menu placement; Tunnel may appear in the overflow. If unpaired, sharing opens Tunnel to review/link. If paired but offline, instant shares queue for that desktop and send on reconnection; confirmation/failure appears in a notification and history. A native Android foreground service keeps the local connection active when you switch apps. Its ongoing notification shows that Tunnel is available. Received text is persisted before acknowledgment and merged into history when the UI resumes; automatic phone clipboard copying occurs while the UI is active. Android controls service lifetime under force-stop/power restrictions.

Visible receipts animate across the viewport on both devices; the Android receipt snackbar opens history. The recent desktop panel aligns filters/search and heading/View all, hides scrollbars, and offers attachment save/copy and a full-quanta dialog.

History shows the latest 200 sent/received transfers, with copy, search, filters, and retry for unconfirmed sends. Clearing history retains recent duplicate IDs, so a retry does not overwrite the clipboard twice. Manually composed offline quanta remain drafts; only instant Android shares automatically queue. Use **Attach something** for up to 32 files, with a combined 250 MiB limit. Files appear in a horizontal carousel inside the quanta box alongside the optional note. History searches notes and filenames. Desktop media cards offer Copy/Save; expand opens the complete quanta and text remains selectable. Android image taps open a viewer; separate Save and Share actions write a local copy or open the system share sheet. Android Save uses Pictures/Tunnel or Downloads/Tunnel (a document picker on API 28).

## Development

```powershell
# From your local Tunnel checkout
npm ci                         # First checkout / changed dependencies
npm run desktop                # Native desktop with hot reload
npm run build                  # Standalone desktop executable, no installer
.\target\release\tunnel-desktop.exe
npm run android                # Hot-reload debug Android + Metro
npm run build:android          # Build/install self-contained Android; no Metro needed
```

Android requires a USB-connected device with USB debugging enabled, or an emulator you start. Expo compiles and installs directly; there is no manual APK sideload step. For hot reload, subsequent JavaScript edits reload through Metro. The standalone build embeds JavaScript and remains runnable after Metro shuts down. Re-run build:android to refresh that embedded code. `npm run mobile` starts Metro alone for an already installed development build. Expo Go does not include the share-intent module.

`npm run build:android:bundle` exports an Android JavaScript/Hermes bundle without launching or installing the app. It is a compilation check, not a runnable native build.

See [setup](../continuity/developer/setup.md) for prerequisites and automated checks, [status](../continuity/status.md) for remaining verification, and [the implementation map](../continuity/agent/map.md) for source routes. Manual and visual testing are left to the user unless explicitly authorized.

## Architecture

| Area | Location | Responsibility |
| --- | --- | --- |
| Desktop UI | `apps/desktop/src` | Composer, Tunnel action, sidebar, pairing QR, history, Aurora settings |
| Native desktop | `apps/desktop/src-tauri/src` | Tray, listener, clipboard, notifications, persistence, startup, shortcut |
| Android connection | `apps/mobile/modules/tunnel-link` | Native foreground service, encrypted connection, persisted receipt inbox, Direct Share |
| Native phone | `apps/mobile/src` | Composer, gesture/haptics, camera, clipboard, secure pairing storage, share intent |
| Shared transport | `packages/shared/src/index.ts` | Validation, encryption, handshake, reconnects, heartbeat, receipts |
| Shared themes | `packages/shared/src/theme.ts` | Stable Aurora contract, complete theme variants, preference validation |
| Aurora snapshot | `vendor/aurora` | One core instance, web adapter, native adapter, provenance and licenses |

The native listener stays alive independently of the desktop WebView. It binds directly to the LAN; there is no Node server to install on the user’s desktop. Messages use ChaCha20-Poly1305 with random 96-bit nonces. A QR supplies the shared key, expiring pairing token, desktop identity, and endpoint. A successful encrypted handshake binds one phone identity. Unlink rotates the key and closes the connection. Account auth and remote relay/discovery are future features; the UI depends on a transport boundary so those can be added without redesigning the composer.

Desktop state/history live in the application’s data directory. Desktop pairing material and history are currently readable by the local user; app-level encryption at rest is not included. Android pairing material uses SecureStore; local draft/history use AsyncStorage. There is no analytics, cloud storage, or account requirement.

Text preserves whitespace and Unicode, with a 64 KB UTF-8 limit. Windows and Android stream attachment bytes in authenticated 48 KiB chunks, bounded at 250 MiB total. A 1,000,000-character encrypted hex frame cap limits individual messages. Update both devices together for this wire change. The non-Android JavaScript fallback remains limited to 5 MiB because it assembles bytes in memory. Received files are saved in private local storage before receipt and opened/exported only through user actions. Receipts follow persistence. Clipboard/notification errors are surfaced while keeping received text in history. Retry uses the original transfer ID to avoid duplicate receipt side effects. A timeout means receipt is unconfirmed, not proof that the text never arrived.

## Scope and verification

This version carries text/links and files, including images and audio files, with optional notes. In-app recording, OCR, cellular/remote transport, accounts, phone-to-phone routing, and continuous clipboard monitoring are not implemented. Local phone-to-multiple-desktop routing is implemented; macOS has a native build command but has not been compiled or exercised on this Windows host. iOS remains unverified. macOS notification activation needs its own implementation when that target is enabled.

See [historical verification](verification.md) for checked behavior and remaining device checks.

Aurora was exported from existing built artifacts in the sibling `aurora` checkout, without modifying that checkout. The provenance manifest identifies this export method. All three private packages are vendored together; the app resolves a single `@aurora/core`. To refresh from a newer built checkout, use the helper in `tools/vendor-aurora.py` after preserving the current snapshot.

## One phone, several desktops

On Android, **Linked devices → Link another desktop** adds a QR pairing without replacing existing desktops. Link Windows and Mac independently on the same reachable LAN. Each desktop still pairs with one phone; the phone retains up to eight desktops with separate keys. Select one or more destination chips above the composer; selections persist. Each recipient has its own connection, history entry and confirmed/failed state. Unlinking one desktop leaves the others intact.

Normal instant Android shares use the selected destinations, queuing independently for offline desktops. Device-specific Android Direct Share shortcuts target that desktop; review mode preselects it in the composer. Android controls how many shortcuts it shows. Composed sends report partial failure instead of silently queuing; their retries retain the original recipient and receipt ID. Automatic remote routing, discovery after an IP-address change, desktop-to-desktop and phone-to-phone are not included.

On a Mac, install Node/npm, Rust and Xcode command-line tools as described in [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), then run from the repository root:

```sh
npm ci
npm run build
./target/release/tunnel-desktop
```

`npm run desktop` supplies hot reload on Mac as well. This is a local binary workflow without installers. Mac runtime, permissions, tray and notification behavior remain pending Mac-side verification. Windows keeps its existing commands and standard executable path.
