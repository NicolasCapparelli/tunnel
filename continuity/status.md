# Status

## Current state

Windows/Android V1 now includes bilateral text/images/files, instant Android text sharing/selected-text action, synchronized device names, tray/background native transport and Aurora themes. Latest feedback adds internal attachment carousels, configurable mobile rails/button, media cards/viewers, genuine Android saving, desktop image/file clipboard, selectable recent text/expand, global Ctrl+Enter and viewport arrival feedback. Native encrypted file streaming supports 250 MiB/32 files; both peers need this update. Auth, remote networks, multi-device routing, macOS and iOS remain future scope.

## Active work and last stopping point

2026-10-08: feedback implementation and automated validation are complete. Android standalone release and final Windows release compile. The running app locked the usual Windows output, so the final build is available alongside it at target/release/tunnel-desktop-next.exe; quit the old app before running that copy or rebuilding the usual path. No app was killed or manually tested. This delivery is prepared for the authorized commit/push; publication outcome belongs in Git and the handoff. Network/multi-device brainstorming is captured in [the proposal](planning/network-transfers.md), with no implementation selected.

## Pending human checks

Manual/visual testing stays with the user. Earlier broad V1 testing does not establish behavior of the latest build.

- H1: desktop Tunnel/Ctrl+Enter with input unfocused and attachments present; recent filter/search, selectable partial text, expand, Copy/Save. Expected: correct content, filenames and bytes; left/right columns align.
- H2: rebuild Android, stop Metro, reopen; test short flick and endpoint burst/reset, Left/Right/Under layouts and Under button. Expected: one send, no falling reset, usable button/rail. Back dismisses focus then traverses pages then exits Tunnel.
- H3: hide desktop to tray, receive text/image and click toast. Expected: notification opens history; single image reaches clipboard. Visible receipt should ripple across window. Previously reported failures need retest.
- H4: rename both devices before/after pairing. User reports renaming works; new Save Name pressed/saving/saved feedback and keyboard-offset snackbar still need review.
- H5: defocus Android and receive text/image. Expected: native service remains reachable, high-importance receipt notification when permission/channel settings allow, history merges on return. Review atom containment and receipt animation; tap receipt snackbar to history. Power/force-stop/network restrictions still apply.
- H6: send a file over the old 5 MiB limit each way, notes/multiple images up to 250 MiB/32 files. Expected: correct stored bytes, internal carousel, image viewer and separate Save/Share. Android Save writes Pictures/Tunnel or Downloads/Tunnel (API 28 asks location). Exceeding bounds preserves the draft. Retry does not duplicate side effects.
- H7: select text in another Android app and invoke Tunnel (possibly overflow); share text offline then reconnect original desktop. Expected: source app stays visible, queued delivery and receipt/history; no send to a newly paired different desktop. Android owns menu ordering.
- H8: persisted per-type Share straight away toggles; reviewed files retain notes, instant files do not open composer. Inspect all themes/media cards/layout comfort manually.

## Blockers and open questions

No implementation/build blocker remains. The running old executable must be quit before replacing its usual path; the new executable is built alongside it. Remote encrypted inbox vs online-only, hub vs mesh and routing defaults are discussion choices, not implementation blockers.

## Last verified state

Desktop/mobile typechecks and 23 shared tests passed; eight Rust tests include ordered/incomplete chunk rejection and an 8 MiB disk-stream fixture; four JVM crypto interoperability tests passed. Android arm64 standalone release compiles with all current source. Windows final release compiles to target/release/tunnel-desktop-next.exe, leaving the locked running copy untouched. All 189 local documentation links/anchors and staged whitespace checks pass. No app launch/install or manual/visual testing was performed. Earlier verification remains [historical](../docs/verification.md).
