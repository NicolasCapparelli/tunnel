# Status

## Current state

Windows/Android V1 now includes bilateral text/images/files, instant Android text sharing/selected-text action, synchronized device names, tray/background native transport and Aurora themes. Latest feedback adds internal attachment carousels, configurable mobile rails/button, media cards/viewers, genuine Android saving, desktop image/file clipboard, selectable recent text/expand, global Ctrl+Enter and viewport arrival feedback. Native encrypted file streaming supports 250 MiB/32 files; both peers need this update. The latest update slows send/receipt/rail motion, restores horizontal particles and fixes desktop equal-width recent controls, centered expand and viewport sizing. Android now supports one phone linked independently to multiple desktops, persisted multi-selection and recipient-specific receipts/retry/background shares. Mac has a native desktop build workflow but is not compiled or exercised here. Auth, remote networks, phone-to-phone and iOS remain future scope.

## Active work and last stopping point

2026-10-14 screenshot follow-up: replaced both browser-preview images with user-supplied native desktop/Android PNGs and updated README captions. Documentation-only publication is authorized; Git history and the delivery response record its outcome. Application changes remain local/uncommitted; README explicitly distinguishes multi-desktop and Mac dispatcher work from published source. Screenshots establish visible UI only, so H1–H10 remain pending. No new product task selected.

2026-10-14: GitHub documentation refresh complete locally. README now leads with purpose, feature examples, portable setup, architecture, limitations, and verification boundaries. Detailed prior README notes are preserved in [usage](../docs/usage.md). Two synthetic-data desktop browser-preview screenshots were captured with explicit permission restricted to Codex. No runtime code or publication changes; no new product task is selected. Earlier application changes remain uncommitted. H1–H10 remain pending; browser screenshots do not close native checks.

2026-10-10: requested UI fixes and local phone-to-multiple-desktop implementation are complete locally. Source changes are uncommitted. The standard Windows executable and Android arm64 standalone APK were rebuilt successfully from final relevant source; the user quit the running desktop to release its executable lock. No alternate Windows executable was produced. No active implementation remains; user verification is next. Remote proposals remain unselected; the latest authorized local scope is in the [roadmap](planning/roadmap.md).

## Pending human checks

Manual/visual testing stays with the user. Earlier broad V1 testing does not establish behavior of the latest build.

- H1: desktop Tunnel/Ctrl+Enter with input unfocused and attachments present; recent filter/search, selectable partial text, expand, Copy/Save. Expected: correct content, filenames and bytes; left/right columns align, filter/search split 50/50, expand is centered and wide home layouts fit the viewport without whole-window scrolling.
- H2: rebuild Android, stop Metro, reopen; test short flick and endpoint burst/reset, Left/Right/Under layouts and Under button. Expected: one send, slower travel/burst/reset and readable receipt feedback, visible horizontal track particles, usable button/rail. Back dismisses focus then traverses pages then exits Tunnel.
- H3: hide desktop to tray, receive text/image and click toast. Expected: notification opens history; single image reaches clipboard. Visible receipt should ripple across window. Previously reported failures need retest.
- H4: rename both devices before/after pairing. User reports renaming works; new Save Name pressed/saving/saved feedback and keyboard-offset snackbar still need review.
- H5: defocus Android and receive text/image. Expected: native service remains reachable, high-importance receipt notification when permission/channel settings allow, history merges on return. Review atom containment and receipt animation; tap receipt snackbar to history. Power/force-stop/network restrictions still apply.
- H6: send a file over the old 5 MiB limit each way, notes/multiple images up to 250 MiB/32 files. Expected: correct stored bytes, internal carousel, image viewer and separate Save/Share. Android Save writes Pictures/Tunnel or Downloads/Tunnel (API 28 asks location). Exceeding bounds preserves the draft. Retry does not duplicate side effects.
- H7: select text in another Android app and invoke Tunnel (possibly overflow); share text offline then reconnect original desktop. Expected: source app stays visible, queued delivery and receipt/history; no send to a newly paired different desktop. Android owns menu ordering.
- H8: persisted per-type Share straight away toggles; reviewed files retain notes, instant files do not open composer. Inspect all themes/media cards/layout comfort manually.

- H9: independently pair the phone with Windows and Mac, select one then both, send text/notes/files, take one recipient offline and retry only its failed history entry. Expected: existing pairings survive, recipient labels/receipts are independent, successful peers receive once, unlinking one does not affect the other. Repeat via instant text share and device-specific Direct Share (including reviewed mode); pending shares remain bound to their original recipient across restart/unlink.
- H10: compile on Mac with the documented native command; check startup, pairing, LAN permission/firewall, tray hiding/reopen, clipboard, file saving and notifications. Expected: receive from the phone while Windows is also paired. Mac build/runtime is unverified from this Windows host; notification-click behavior needs its own followup.

## Blockers and open questions

No source/build blocker remains on Windows/Android. The normal executable replacement passed after the user's tray Quit. Manual/visual assessment stays with the user, including Mac compilation/runtime. Multi-desktop routing is LAN-only with current QR endpoints; address discovery and remote routing are unimplemented.

## Last verified state

2026-10-14 documentation refresh: Node 24.13.1/npm 11.8.0; `npm test` (30 tests), `npm run typecheck` (desktop/mobile), `npm run test:rust` (8 tests), `npm run build:web`, and `npm run build:android:bundle` pass using existing installed dependencies. `npm run dev` served the preview for the approved Codex-only composer/appearance captures. New README/usage/status/log links, anchors and image paths were checked, along with documentation whitespace. Fresh `npm ci`, native release builds/install, JVM tests, and full UI/native smoke suites were not rerun. No native device behavior was exercised. The following results are retained from 2026-10-10:

Final desktop/mobile typechecks and 30 shared tests pass, including seven new legacy-registry/recipient-routing tests. Final Android arm64 standalone release and four existing JVM crypto tests pass (zero failures/errors). The supported `npm run build` succeeds at `target/release/tunnel-desktop.exe`, embedding frontend assets; build logs are `.tools/oct10-desktop-final.log` and `.tools/oct10-android-verified.log`. Eight previously passing Rust tests were not rerun: native Rust protocol was unchanged. Final local documentation-link and whitespace checks pass. No app launch/install, screenshot review, manual or visual testing occurred. Earlier verification remains [historical](../docs/verification.md).
