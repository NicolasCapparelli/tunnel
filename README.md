# Tunnel

A private passage for text between Windows and Android. React + Tauri on desktop, React Native + Expo on mobile, with a shared Aurora contract and encrypted transfer protocol.

The default **Mineral** theme uses soft sage surfaces and teal. **Dune** and **Tide**, plus light/dark/system appearance, are available on both devices. Dark variants use slate surfaces. Theme changes preserve navigation and drafts.

## Run locally

Work from `C:/Users/cappa/Desktop/Projects/tunnel`. Build/run commands and prerequisites are maintained in [Continuity setup](continuity/developer/setup.md). Local native builds are the current workflow; installers and distribution packaging are disabled.

Install and open Tunnel on both devices, on the same Wi-Fi. On Windows, open **Linked devices**, create a QR code, then scan it from Android’s **Linked devices** page. Codes expire after five minutes. Windows lets you choose a network address if there are multiple adapters; select the Wi-Fi/LAN address the phone can reach.

If camera scanning is unavailable, **Copy pairing code** on Windows supplies the JSON accepted by the Android pairing form.

If Windows prompts about network access, allow Tunnel on your private network. The desktop listens on TCP **53177**. Guest Wi-Fi and networks with client isolation can block device-to-device connections. Internet/cellular transfer is not implemented yet.

Type or paste into the large composer, then drag the particle up the adjacent rail. Release past 80% of the track to send; a shorter drag cancels. Desktop also supports **Ctrl+Enter**. Screen-reader users have a send action. The draft clears after the peer confirms receipt. A changed draft is preserved if you keep typing while sending.

Incoming text copies to the clipboard by default. Switch this off in settings. Windows sends a notification; its activation callback opens history. Notifications contain a generic receipt rather than the transferred text. Closing the Windows window hides it in the tray. The tray menu has Open, History, and Quit. **Ctrl+Shift+Space** opens Tunnel, and launch at login is an optional setting.

Android can receive shared text/URLs from another app into its composer. Keep the phone app in the foreground for desktop-to-phone delivery. Android background receiving is not included in this version.

History shows the latest 200 sent/received transfers, with copy, search, filters, and retry for unconfirmed sends. Clearing history retains recent duplicate IDs, so a retry does not overwrite the clipboard twice. Offline text remains a draft; this version does not automatically send an offline draft later.

## Development

```powershell
cd C:\Users\cappa\Desktop\Projects\tunnel
npm ci                         # First checkout / changed dependencies
npm run desktop                # Native desktop with hot reload
npm run build                  # Standalone desktop executable, no installer
.\target\release\tunnel-desktop.exe
npm run build:android          # Build/install debug Android app and start Metro
```

Android requires a USB-connected device with USB debugging enabled, or an emulator you start. Expo compiles and installs directly; there is no manual APK sideload step. Subsequent JavaScript edits reload through Metro. `npm run mobile` starts Metro alone for an already installed development build. Expo Go does not include the share-intent module.

`npm run build:android:bundle` exports an Android JavaScript/Hermes bundle without launching or installing the app. It is a compilation check, not a runnable native build.

See [setup](continuity/developer/setup.md) for prerequisites and automated checks, [status](continuity/status.md) for remaining verification, and [the implementation map](continuity/agent/map.md) for source routes. Manual and visual testing are left to the user unless explicitly authorized.

## Architecture

| Area | Location | Responsibility |
| --- | --- | --- |
| Desktop UI | `apps/desktop/src` | Composer, rail, navigation, pairing QR, history, Aurora settings |
| Native desktop | `apps/desktop/src-tauri/src` | Tray, listener, clipboard, notifications, persistence, startup, shortcut |
| Native phone | `apps/mobile/src` | Composer, gesture/haptics, camera, clipboard, secure pairing storage, share intent |
| Shared transport | `packages/shared/src/index.ts` | Validation, encryption, handshake, reconnects, heartbeat, receipts |
| Shared themes | `packages/shared/src/theme.ts` | Stable Aurora contract, complete theme variants, preference validation |
| Aurora snapshot | `vendor/aurora` | One core instance, web adapter, native adapter, provenance and licenses |

The native listener stays alive independently of the desktop WebView. It binds directly to the LAN; there is no Node server to install on the user’s desktop. Messages use ChaCha20-Poly1305 with random 96-bit nonces. A QR supplies the shared key, expiring pairing token, desktop identity, and endpoint. A successful encrypted handshake binds one phone identity. Unlink rotates the key and closes the connection. Account auth and remote relay/discovery are future features; the UI depends on a transport boundary so those can be added without redesigning the composer.

Desktop state/history live in the application’s data directory. Desktop pairing material and history are currently readable by the local user; app-level encryption at rest is not included. Android pairing material uses SecureStore; local draft/history use AsyncStorage. There is no analytics, cloud storage, or account requirement.

Payloads preserve whitespace and Unicode, with a 64 KB UTF-8 limit. Receipts follow persistence. Clipboard/notification errors are surfaced while keeping received text in history. Retry uses the original transfer ID to avoid duplicate receipt side effects. A timeout means receipt is unconfirmed, not proof that the text never arrived.

## Scope and verification

This V1 carries text and links. The attachment control is visibly marked **Soon**. Images, files, audio, OCR, cellular/remote transport, accounts, multi-device routing, and continuous clipboard monitoring are not implemented. macOS and iOS are next targets; this checkout has not been built or exercised on those platforms. macOS notification activation needs its own implementation when that target is enabled.

See `docs/verification.md` for checked behavior and remaining device checks.

Aurora was exported from existing built artifacts in `C:/Users/cappa/Desktop/Projects/aurora`, without modifying that checkout. The provenance manifest identifies this export method. All three private packages are vendored together; the app resolves a single `@aurora/core`. To refresh from a newer built checkout, use the helper in `tools/vendor-aurora.py` after preserving the current snapshot.
