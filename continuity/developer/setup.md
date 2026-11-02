# Setup

## Prerequisites

Run commands in the repository root, currently `C:/Users/cappa/Desktop/Projects/tunnel`. Use Node 24 LTS and npm. Windows native builds require Rust's MSVC toolchain, Visual Studio C++ build tools and WebView2. This local checkout carries an ignored portable Rust toolchain under `.tools/`; other checkouts need their own Rust installation.

Android 9/API 28 or later is required by the native ChaCha20-Poly1305 provider. Android builds require Android Studio's SDK, platform/build tools compatible with Expo 57, and its Java runtime (or a suitable configured JDK). [Android helper](../../tools/android.ps1) honors JAVA_HOME and ANDROID_HOME/ANDROID_SDK_ROOT, then tries standard Android Studio paths. No account, cloud service, or build secrets are needed. Pairing keys are runtime data, never repository configuration.

## Local commands

```powershell
cd C:\Users\cappa\Desktop\Projects\tunnel
npm ci
npm run desktop                       # Tauri dev + Vite, hot reload
npm run build                         # Standalone native desktop release, no installer
.\target\release\tunnel-desktop.exe
npm run android                       # Debug native build + install + Metro hot reload
npm run build:android:apk             # Build standalone ARM64 APK without install or launch
npm run build:android                 # Bundled standalone build + install; runs without Metro
npm run mobile                        # Metro alone after the development app is installed
```

Android build/run needs a USB-debugging device (accept its authorization prompt) or an emulator you started. Expo compiles and installs directly, avoiding manual APK sideloading. Keep Metro running for the hot-reload workflow; the self-contained build embeds JavaScript and runs after Metro stops. It uses the existing local development signing configuration; this is not distribution packaging. Expo Go lacks the native share-intent module. The Android helper chooses the debug/hot-reload or release/embedded variant; both install directly via CLI. `npm run dev` is a browser preview only; native tray/network/clipboard behavior requires Tauri.

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

Both devices must share a reachable private IPv4 network. Windows listens on TCP 53177; allow private-network firewall access if prompted. Select the reachable Wi-Fi address in Linked devices when several adapters exist. Guest network isolation, VPN routing and sleep can interrupt delivery. Android uses a native remote-messaging foreground service after pairing, with an ongoing connection notification. Grant notification permission for receipt notifications. Clipboard processing waits for the foreground UI. OS force-stop and battery/network restrictions can still interrupt availability. Pairing QR codes expire after five minutes; copy/manual JSON pairing is available if scanning fails.

Generated `apps/mobile/android`, Tauri `src-tauri/gen` schemas, build outputs, `.tools`, node_modules and runtime state are ignored. After relocation regenerate native Android files to discard absolute CMake paths; this move retains the old generated directory only as `.tools/android-before-move`. Install dependencies again after relocation to repair workspace links. The user must launch dev/device commands to assess runtime behavior; they were not launched during relocation.

## Attachment and share updates

Rebuild both devices for the chunked attachment protocol. The current native Android module supplies selected-text actions, instant sharing, file persistence and an outbox; Expo Go cannot provide these. Defaults: instant Text, reviewed Images/Other files. Configure these in Share straight away. Native transfers support 250 MiB/32 attachments with disk streaming; update both peers together. Resumable transfers remain future scope. Native receipt notification permissions still apply. Main Android share target is ShareActivity; source apps/Android choose selection toolbar vs overflow placement. iOS continues opening the composer and is not verified in this Windows/Android iteration.

## Multiple desktops and Mac iteration

Pair each desktop independently by QR from Android Linked devices; adding a peer retains existing keys. Select destinations above the phone composer. All selected recipients must confirm for an unchanged draft to clear; retry failed recipients in history. Instant shares queue per selected desktop; Direct Share chooses a specific desktop. Every desktop must be reachable on the same private IPv4 LAN; IP-address discovery is not implemented.

Root desktop commands now use [Node dispatch](../../tools/desktop.mjs), retaining the [Windows helper](../../tools/desktop.ps1). On a Mac with Node/npm, Rust and Xcode command-line tools ([official prerequisites](https://v2.tauri.app/start/prerequisites/)), run `npm ci`, `npm run build`, then `./target/release/tunnel-desktop` from the repository root. `npm run desktop` is the hot-reload path. Windows executable path and Android CLI commands remain unchanged. No distribution bundle is built. Mac compilation, LAN permissions and tray/notification behavior need Mac-side verification.

## Singularity setup guide

Singularity stores text quanta and organized spaces in local SQLite, then syncs through Entanglement realtime mode to a Cloudflare Worker with a SQLite Durable Object. Devices sign in separately with the same identity. Spaces organize that identity's devices; external account invitations and attachment storage are not implemented.

### Current account setup checkpoint

Cloud configuration remains unchanged. The user declined the proposed native handoff; no token Bypass application or CORS header was added.

- Official Cloudflare skills are installed under `C:/Users/cappa/.agents/skills`. The global Codex Cloudflare MCP server is authenticated and available.
- Account: `37766e6711b4aaa33fe1f890955fd9bc`. Existing Zero Trust organization: `dawn-haze-fad8.cloudflareaccess.com`. Existing Cloudflare identity provider is restricted to account members; Singularity additionally permits only `ngcsrp@gmail.com`.
- Worker: `https://tunnel-singularity.ngcsrp.workers.dev`, with SQLite Durable Object `SPACES`. Deployment version: `504ef9fd-0f0f-47e8-a336-75311a8153ed`. Actual team domain and AUD are saved in `apps/cloudflare/wrangler.jsonc`.
- Main Access app: `488d68b3-5e70-4531-a2c8-94fcbcc0d96e`. Managed OAuth has 15-minute access tokens, 14-day grants, dynamic registration and only the exact HTTPS `/oauth/callback` redirect. Desktop CORS origins and methods are configured.
- Separate Bypass apps: callback `71e43fe6-3643-4e93-b844-29be0fcd3ba6`; hints `94362b27-78e4-4553-bce1-2fbe4a778b11`; health `bdb9fa22-b9c2-4354-8970-f5f4d8211253`. Reusable policies: owner `b739a91a-6e91-4e6b-b5e0-e2753afcf31e`; public endpoints `31b69475-2259-4e3d-abd1-4dec10f63aa4`. Bypass is not attached to the main app.
- Both ignored local app `.env` files contain the Worker endpoint. Existing values were preserved. Build delivery is recorded in status.
- Live checks: health 200; unsigned data route 401 from Access with OAuth discovery challenge; OAuth metadata 200; desktop API preflight 200; OAuth endpoint preflights 204; native/no-Origin client registration 201; callback forwards code/state to the fixed Tunnel deep link; invalid WebSocket hint ticket 401. No authenticated account writes or cross-device sync were tested.

### Managed OAuth investigation checkpoint

The user declined the custom public code-exchange endpoint. Its Worker routes, Durable Object binding/migration, shared JWT-header transport and Reconnect controls were removed before any deployment. Do not request approval for or deploy that alternative. No production Access policy changed.

Default sign-in again uses Cloudflare Managed OAuth authorization-code/PKCE with the existing exact HTTPS callback. Live discovery advertises no `scopes_supported`; the helper now omits scope rather than inventing `openid email offline_access`. If discovery later advertises these scopes, it requests only their supported intersection and registers the same scope list. Registration no longer includes the nonstandard resource field; RFC 8707 resource remains on authorization, token exchange and refresh. A versioned registration profile replaces cached clients from the former request once, preserving account content and existing credentials until successful completion. Later sign-ins reuse a matching registration.

The scope correction was not a confirmed root cause. The 2026-10-31 user HAR now shows successful first approval: consent 302 to the HTTPS callback, then 302 to `tunnel://singularity-auth` with unchanged code/state. A second click reuses consumed consent and returns 400. Windows had no registered `tunnel` handler because frontend registration lacked permission and ignored its error. Native startup now calls the deep-link plugin’s configured-scheme registration on Windows/Linux, propagating errors; this supports the standalone executable without an installer. The frontend no longer tries to register the scheme. Existing single-instance forwarding delivers callbacks to the running app. Desktop typecheck and Windows release build pass; app completion remains a human check. Open the rebuilt executable, start a fresh sign-in, click Allow once and accept any browser Open Tunnel prompt. Do not reuse the old consent page.

Windows uses restricted native HTTPS for metadata, registration, tokens, identity and revocation, without WebView Origin/cookies or redirects and with timeout/payload limits. Android uses native fetch. OAuth tokens refresh silently within the grant duration; Access continues enforcing the existing owner-only policy. Sign-out revokes the refresh token where supported, clears credentials and retains local account content.

Cloudflare also supports email one-time PIN and external identity providers, plus SaaS SAML/OIDC federation. Managed OAuth is its documented native/non-browser token flow. Changing the login provider has not been shown to fix the post-login consent failure. Existing Cloudflare account-member login remains selected; no alternative provider was configured. See [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/) and [identity providers](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/).

No billing changes were made. Subscription read is unavailable to this OAuth connection (403; API token with Billing Read required), so the account plan was not verified. Do not select a paid plan. Device consent/callback, refresh and cross-device sync remain unverified. Build and delivery results are recorded in status.

### Use the configured builds

Windows and Android release builds are ready with the restored Managed OAuth flow. No production policy or Worker deployment is required for this client request correction. See the checkpoint above.

1. On Windows, open `target/release/tunnel-desktop.exe` from this repository. The build has the configured endpoint and native sign-in transport.
2. Install `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` on the Android phone, then open Tunnel. The APK has the same endpoint. Installation was not performed by the agent.
3. On each device, open **Singularity → Sign in with Cloudflare**. Use `ngcsrp@gmail.com`; the policy permits only this email. Start a fresh sign-in, complete Cloudflare login and approve the Cloudflare consent page, then return to Tunnel. The helper automatically replaces the older cached client registration once.
4. Add a text quantum on Windows and check that it appears on Android. Create a project space and entry on Android and check that both appear on Windows.
5. Complete the offline/restart and sign-out checks in [Verify the deployment](#6-verify-the-deployment). Testing another identity requires explicitly adding it to the owner policy first.

Automated verification: all 36 tests and workspace typechecks pass after removing the handoff and correcting Managed OAuth requests. The actual helper registers and reaches Access login with scope omitted; authenticated approval is not tested. Both native release builds pass (Windows native compilation 1m53s; Android build 42s). Logs: `.tools/singularity-managed-{tests,typecheck,desktop,android}.log`.

The numbered configuration sections below are reference steps for a new account or checkout; do not create duplicate Access applications in this account.

### 1. Deploy a first Worker

1. Open PowerShell in the Tunnel repository root and run `npm install`.
2. Run `npx wrangler login` and finish the browser login.
3. Run `npm run deploy -w @tunnel/singularity-worker`. The checked-in configuration includes the SQLite Durable Object migration. The first deploy has placeholder Access values and cannot authenticate yet.
4. Copy the Worker URL, such as `https://tunnel-singularity.<workers-subdomain>.workers.dev`.

### 2. Configure Cloudflare Access

1. Open Zero Trust and select the Free plan if it is not already configured. In **Settings → Authentication → Login methods**, enable your chosen identity provider. Cloudflare's email one-time PIN is an option requiring no external provider configuration. A Cloudflare dashboard account alone does not configure Tunnel's login policy.
2. Open **Access controls → Applications → Add an application → Self-hosted**. Use the exact Worker hostname, with no path or wildcard. Use hostname-based Access, since Worker-level Access does not support WebSockets.
3. Add an **Allow** policy restricted to your own email/identity. Select your login provider for this application.
4. Enable **Managed OAuth** and dynamic client registration. Use a short access-token lifetime (15 minutes here) and longer grant session (14 days here). The separate Access browser session is 24 hours.
5. Use only the exact redirect URI `https://<your-worker-host>/oauth/callback`.
6. Configure Access CORS to allow `http://tauri.localhost` for release, `http://localhost:1427` for development, and `tauri://localhost` if your WebView uses it. Allow methods `GET, POST, DELETE, OPTIONS` and headers `Authorization, Content-Type`. Enable **Bypass OPTIONS requests to origin** if Access does not answer preflight itself. Android native fetch does not enforce browser CORS.
7. Create a **separate Self-hosted Access application** for the same hostname with the exact path `/oauth/callback`. Give it a **Bypass** policy with **Include → Everyone**. The callback forwards the code/state to the fixed `tunnel://singularity-auth` link; Tunnel verifies state and PKCE. Do not put this Bypass policy on the main hostname application.
8. Create two more path-specific Self-hosted applications for `/v1/hints` and `/health`, each with **Bypass → Include → Everyone**. Hints require a short-lived one-use ticket; health has no account data. All other `/v1/*` routes must retain the main Allow policy.
9. Copy the main application's **Audience (AUD) tag** and Zero Trust team domain, such as `my-team.cloudflareaccess.com`.

These path applications are required: policies do not contain their own URL-path selector. See [Cloudflare path-specific bypass](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/), [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/), [Workers Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), and [Access CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/).

### 3. Connect the Worker to Access

1. Open `apps/cloudflare/wrangler.jsonc`.
2. Replace `ACCESS_TEAM_DOMAIN` with your team domain, without `https://`.
3. Replace `ACCESS_AUDIENCE` with the main application's AUD tag.
4. Run `npm run deploy -w @tunnel/singularity-worker` again.
5. Open `https://<your-worker-host>/health`. Expect `{"ok":true}`.

Keep the `SPACES` binding and checked-in Durable Object class/migration names after deployment. Access exposes OAuth metadata at `https://<your-worker-host>/.well-known/oauth-authorization-server`; confirm this returns JSON if login fails. Managed OAuth tokens are opaque; Access validates them and forwards a signed assertion that the Worker validates.

### 4. Configure Windows

Build-operation permission (2026-10-31): the user authorizes the agent to close the Windows Tunnel process when required to replace its executable, without asking each time. Limit this to Tunnel; this does not authorize unrelated app control or launching/testing the app.

Desktop OAuth and sync HTTP use native HTTPS. Sync has a separate allowlist for Entanglement routes, numeric history queries and GET/POST/DELETE methods; it sends no browser Origin or cookies and follows no redirects. Native requests have a 30-second timeout. Sync requests/responses are limited to 8 MiB; OAuth retains its 64 KiB request/1 MiB response limits. Realtime websocket hints remain ticket-protected; polling also runs every 45 seconds.

1. The local `apps/desktop/.env` is already configured for this account. For a new checkout, copy `apps/desktop/.env.example` to `apps/desktop/.env`.
2. Set `EXPO_PUBLIC_SINGULARITY_ENDPOINT` to the full Worker URL without a trailing slash.
3. Run `npm run desktop` for development, or `npm run build` for the standalone executable. Restart/rebuild after changing the endpoint.
4. Open **Singularity → Sign in with Cloudflare** and complete login in the browser. Click Allow once, then accept any browser prompt to open Tunnel. The browser returns using `tunnel://singularity-auth`. The standalone app registers this scheme at startup; reopen the rebuilt executable after moving or replacing it.

### 5. Configure Android

The mobile entry point installs the missing random-values API using Expo Crypto before loading App/Entanglement. If an older APK shows `Property 'crypto' doesn't exist` after sign-in, install the rebuilt APK over the existing app, then reopen Singularity. Keep app data to retain credentials and local content.

1. The local `apps/mobile/.env` is already configured for this account. For a new checkout, copy `apps/mobile/.env.example` to `apps/mobile/.env`.
2. Set `EXPO_PUBLIC_SINGULARITY_ENDPOINT` to the same Worker URL.
3. Rebuild/install using `npm run android` or `npm run build:android`. These commands update native configuration, including Expo SQLite. Expo Go cannot run this feature.
4. Open **Singularity → Sign in with Cloudflare** and use the same identity as Windows.

### 6. Verify the deployment

1. Save a text quantum on Windows; expect it in Android's searchable Raw quanta list.
2. Create a project space and titled entry on Android; expect both on Windows.
3. Disconnect a device, add text, close/reopen Tunnel, then reconnect. Expect local content to persist and sync afterward.
4. Sign out, then sign in with a different permitted identity. Expect a separate empty account; signing back in restores the original account's data.
5. Confirm that signed-out requests to `/v1/account` and `/v1/head` are denied. Only callback, health and ticket-protected hints bypass Access.

Sign-out stops synchronization and clears credentials; the local account database remains on the device. This implementation supports text quanta and create/search for spaces and entries. Editing/deletion, attachments and sharing with other accounts are not implemented. Existing Cloudflare configuration passed unauthenticated checks. The latest HAR confirms first approval and the native redirect succeed; Windows callback registration is corrected and needs a fresh app-completion check. Native callbacks and authenticated device behavior still require these manual checks; compilation does not establish them.

Cloudflare Free quotas are account-wide and may change. Check [Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) before deployment.
