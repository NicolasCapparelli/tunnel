# V1 verification

## Automated checks

- Desktop and mobile TypeScript checks pass.
- Desktop Vite production build passes; fonts are bundled for offline use.
- Android Hermes production bundle passes.
- Android native APK build passes (arm64-v8a and x86_64).
- Windows native compile and installer build pass.
- Nine shared protocol/theme tests pass: UTF-8 limits, encryption integrity, local-only QR validation/expiry, receipts, reconnects, and complete readable Aurora variants.
- Three Rust protocol tests pass, including the exact JavaScript encryption fixture.
- Five Chrome UI tests pass: draft persistence, honest browser preview, gesture cancellation/completion, paste append, failed-send preservation, theme selection persistence, and responsive layout without horizontal overflow.
- The actual native Android APK launches in the headless Android emulator without React Native startup errors. The actual rendered composer was visually inspected.
- Native end-to-end test passes: Android pairs with the real Tauri listener, the upward gesture sends text to Windows, Windows auto-copies it, Windows sends back to Android, Android auto-copies it, ACTION_SEND text appends to the phone composer, and unlink rejects revoked credentials. The host clipboard is restored after the test.

The browser’s native-IPC tests use a test-only mock; they do not establish network delivery. `tests/native-smoke.mjs` drives a separately launched Tauri WebView and Android emulator to verify the native path. It runs against isolated desktop storage. `tools/start-native-smoke.ps1` opens a localhost WebView debugging endpoint for this development test; do not use it to launch the normal app. Production builds ignore the test-storage environment variable.

## Remaining real-device checks

- Scan a desktop QR with a physical Android camera. Emulator pairing uses the same actual desktop payload through the manual pairing input, with the emulator host alias.
- Verify notification click activation in the installed Windows build. The native Windows toast has an activation callback that shows the window and selects history; installed notification behavior has not been exercised with OS UI automation.
- Verify Windows private-network firewall onboarding, LAN adapter changes, sleep/wake, and a physical Android phone on Wi-Fi.
- Verify launch-at-login and the global shortcut against the user’s installed apps; shortcut registration conflicts are surfaced in the UI.
- macOS/iOS builds and native lifecycle behavior are not yet verified.

## Dependency review

The test runner was upgraded to patched Vitest 5.0.3. The current npm audit still reports inherited Expo/React Native build-chain advisories rooted in braces, node-forge, and the xcode package’s older uuid. The available registry versions of braces/node-forge remain in their advisory ranges. npm’s suggested React Native downgrade is not appropriate for Expo 57. No force downgrade or incompatible override was applied. Recheck these dependencies before public distribution; this is a development build.
