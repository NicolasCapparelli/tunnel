# Setup

## Prerequisites

Run commands in the repository root, currently `C:/Users/cappa/Desktop/Projects/tunnel`. Use Node 24 LTS and npm. Windows native builds require Rust's MSVC toolchain, Visual Studio C++ build tools and WebView2. This local checkout carries an ignored portable Rust toolchain under `.tools/`; other checkouts need their own Rust installation.

Android requires Android Studio's SDK, platform/build tools compatible with Expo 57, and its Java runtime (or a suitable configured JDK). [Android helper](../../tools/android.ps1) honors JAVA_HOME and ANDROID_HOME/ANDROID_SDK_ROOT, then tries standard Android Studio paths. No account, cloud service, or build secrets are needed. Pairing keys are runtime data, never repository configuration.

## Local commands

```powershell
cd C:\Users\cappa\Desktop\Projects\tunnel
npm ci
npm run desktop                       # Tauri dev + Vite, hot reload
npm run build                         # Standalone native desktop release, no installer
.\target\release\tunnel-desktop.exe
npm run build:android                 # Expo debug native build + install + Metro
npm run mobile                        # Metro alone after the development app is installed
```

Android build/run needs a USB-debugging device (accept its authorization prompt) or an emulator you started. Expo compiles and installs directly, avoiding manual APK sideloading. Keep Metro running for JavaScript iteration. Expo Go lacks the native share-intent module. `npm run android` aliases the same build/run workflow. `npm run dev` is a browser preview only; native tray/network/clipboard behavior requires Tauri.

The desktop binary works without Vite or a Node server. Close hides it to the tray; Quit exits. Build settings: [desktop helper](../../tools/desktop.ps1), [Cargo target directory](../../.cargo/config.toml), [binary name](../../apps/desktop/src-tauri/Cargo.toml), [Tauri config](../../apps/desktop/src-tauri/tauri.conf.json). Distribution bundles are disabled.

## Automated verification

```powershell
npm run typecheck
npm test
npm run test:rust
npm run build:android:bundle           # Hermes export; no device launch/install
```

These are compilation/unit checks. UI/native smoke scripts exist but must not be run without explicit user authorization for manual/visual work; see [contract](../agent/instructions.md). Earlier evidence is in [verification](../../docs/verification.md); current moved-checkout results are in [status](../status.md#last-verified-state).

## Network and troubleshooting

Both devices must share a reachable private IPv4 network. Windows listens on TCP 53177; allow private-network firewall access if prompted. Select the reachable Wi-Fi address in Linked devices when several adapters exist. Guest network isolation, VPN routing and sleep can interrupt delivery. Android receiving runs only while active. Pairing QR codes expire after five minutes; copy/manual JSON pairing is available if scanning fails.

Generated `apps/mobile/android`, Tauri `src-tauri/gen` schemas, build outputs, `.tools`, node_modules and runtime state are ignored. After relocation regenerate native Android files to discard absolute CMake paths; this move retains the old generated directory only as `.tools/android-before-move`. Install dependencies again after relocation to repair workspace links. The user must launch dev/device commands to assess runtime behavior; they were not launched during relocation.
