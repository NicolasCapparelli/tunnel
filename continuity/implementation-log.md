# Implementation log

## 2026-11-01 — Crop polish and workstream closure

Reviewed the user-supplied screenshot (no computer control). Separate translucent mask rectangles met at fractional pixel boundaries, consistent with the visible line. `OcrCrop.tsx` now draws one even-odd SVG mask around the selection. Retake and Reset are adjacent on the right, as 48 dp icon buttons: Camera for a new photo, Scan’s four-corner frame for full-image reset. Accessible names/hints, disabled/pressed feedback, Aurora tokens and Continue remain. Updated design, usage, selected scope and status. User approves committing/pushing all accumulated work and closing this workstream; final mask/icon device appearance remains unconfirmed under H17.

Verification: workspace typechecks, 51 tests/12 files and Android ARM64 standalone release build pass (Gradle 47s). Logs: `.tools/workstream-typecheck.log`, `.tools/crop-polish-{tests,android}.log`. Final aggregate source is tested; intermediate commits are not independently build-tested. Reviewed source/diffs, staged scope and documentation routes/whitespace. No app install/launch or UI automation. Human check: install the rebuilt APK, drag a crop and expect continuous dimming with no line beyond its boundary; right-side Camera retakes and four-corner frame restores the full image. No further implementation selected.

The authorized commit series groups Axis assets/build refresh, shared/native multi-desktop and Singularity infrastructure, Dusk application shells, and mobile camera/cropped OCR. Partial commits may leave later layers in the working tree; this entry describes the complete aggregate delivery. Historical and unrelated human checks remain in status. Archived the oldest entry to [October history](history/implementation/2026-10.md#2026-10-31--dusk-windows-and-android-migration).

## 2026-11-01 — OCR crop review and shutter flash

User reports initial camera/OCR behavior works as a starting point, but both shutter actions cause a large viewport flash. Source inspection found Expo Camera paints a white root-view foreground by default. `CaptureCamera.tsx` now disables `animateShutter` in both modes and explicitly keeps flash off. Device confirmation remains pending.

OCR now pauses on a still-image review (`OcrCrop.tsx`), with the entire image selected. Four 48 dp corner targets resize freely; dragging the interior moves the selection. Dimmed outside areas, existing Aurora surfaces/accents/DM Sans, Reset, Retake and a full-width 60 dp Continue follow the current design language. Continue runs OCR only on the selected area; leaving it unchanged recognizes everything. Screen-reader actions adjust corners and selection. Progress locks duplicate actions; errors retain the photo/crop for retry. Close/Retake/success clean up the temporary original. Regular Camera still attaches immediately.

`crop.ts` owns normalized upright-image geometry and contain fitting; three new tests cover full-image default, portrait/landscape fitting, all four corners, translation, minimum size and image bounds. `connection.ts` and TunnelApp pass the selected crop to native recognition. TunnelLink validates crop fractions, uses EXIF-aware Android ImageDecoder with a 4096 px longest-side cap, crops before ML Kit and releases the bitmap after completion. Updated usage, design, model, source map, selected roadmap and H17. Archived the oldest entry to [October history](history/implementation/2026-10.md#2026-10-31--dusk-photo-viewer).

Verification: final mobile typecheck, all 51 tests/12 files and Android ARM64 standalone release build pass (Gradle 42s). Initial native build also passed; final build includes the handle placement/bounds review refinements. Logs: `.tools/crop-{typecheck,tests,android-final}.log`. Source changes and documentation links/whitespace reviewed. No install, launch, UI automation, screenshots or manual/visual testing. Human next (H17): install the APK over existing data; verify no flash in either mode, unchanged/full OCR, selected-text-only OCR, Reset/Retake/Back, errors/retry, orientation/edge accuracy, background/resume and screen-reader controls. No further implementation selected.

## 2026-11-01 — Mobile camera and OCR

Implemented the user-selected Android Tunnel row with four equal 60 dp icon buttons: Attach, OCR, Camera, Paste. `apps/mobile/src/CaptureCamera.tsx` reuses Expo Camera, waits for readiness, locks duplicate captures, handles background/resume and deletes temporary photos after processing. `TunnelApp.tsx` requests permission and merges results into the current draft. Camera immediately copies a captured JPEG into private durable draft storage; rejected attachments are deleted through `files.ts`. Neither action sends automatically. Accessible button names and existing Aurora tokens are retained.

The native TunnelLink module exposes cache-only photo recognition using bundled ML Kit Latin-script text recognition 16.0.1; `connection.ts` bridges it. OCR appends recognized text while preserving whitespace and the current note/photos; empty results and the combined UTF-8 size limit reject without replacing the draft. `camera-draft.ts` and three regression tests cover empty recognition, existing notes, multiline/Unicode text and exact UTF-8 boundaries. Updated camera permission copy, usage, design extension, data lifecycle, map, selected roadmap and status H16. Archived the oldest log entry to [October history](history/implementation/2026-10.md#2026-10-31--dusk-mock-handoff).

Verification: mobile typecheck, 48 tests in 11 files and native Android ARM64 standalone release build pass (Gradle 1m 13s); APK archive inspection confirms bundled text-model assets. Initial sandbox build could not access the Gradle cache; the authorized build retry succeeded. Logs: `.tools/camera-{typecheck,tests,android}.log`. Reviewed source changes, new documentation routes and whitespace. APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. No install, launch, UI automation, camera or visual test. Human next: install over existing data and run H16 (OCR append/no-text, photo capture, permission/cancel/background, limits, draft persistence, paired send, all rail modes and Attach/Paste/pairing regression). Desktop/iOS OCR is unimplemented; no further scope selected.

## 2026-11-01 — Desktop grid and settings polish

- Scrollbars are hidden globally (`scrollbar-width: none` and WebKit rules). The History `thin` scrollbar is removed.
- History grid: download-all for photo stacks moved into `history-item-actions` (`AttachmentHistory` `inlineDownload={false}`, shared `saveAllPhotos`). Card rows are `1fr auto` and attachments use `safe center`, so tall tiles grow the card instead of overflowing the meta line. Grid file-tile art is 64px. Tile focus rings are inset. Stack previews are 210×200, with 138×170 prints.
- Settings: the dusk `.page-heading` starts at the left. The base `space-between` had pushed sub-page titles to the right. `workspace-settings` caps the heading and content at 880px, centered.

Verification: desktop typecheck and `vite build` pass. No native build, launch or visual test.

## 2026-11-01 — Phone dynamic grid

- The user confirmed the lag, fade and selector fixes work.
- Added a phone version of the desktop dynamic grid. `apps/mobile/src/layout.ts` has `pairRows` (pairs consecutive compact items and keeps order) and `compactQuanta` (photo-only quanta).
- History's `FadeList` now renders rows. Paired photo cards are half width with equal height, have no "N photos" label, and keep their header and status on one line. Singularity spaces pair two per row. Singularity quanta are text, so they stay full width.
- Tests: new `tests/mobile-layout.test.ts`.

Verification: mobile typecheck and 45 tests pass. No build, launch or visual test.

## 2026-11-01 — History filter lag and Singularity switch

- The user confirmed tab-switch lag improved after the composer animation fix, but some remains. History's Received/Sent/All filter was still slow.
- Cause: History mounted every card (up to 200) in one ScrollView. Each card has SVG icons and photo stacks with hardware layers, so each filter change or tab switch remounted them all.
- Fix: History is now a virtualized `FadeList` (FlatList that shares `FadeScroll`'s edge logic through `useFadeEdges` in `DuskPrimitives.tsx`). Filtering is memoized and uses `useDeferredValue`, so the selected segment updates first.
- Phone Singularity's Quanta/Spaces buttons are now History's segmented control.

Verification: mobile typecheck and 42 tests pass. Prettier ran on the three mobile files. No build, launch or visual test.

## 2026-11-01 — Dusk review round 2 follow-up

- Android fades: React Native's `fadingEdgeLength` uses a fixed strength (`ReactScrollView.getTopFadingEdgeStrength`), so edges faded even at scroll position 0. That cut the device pills and the first History card. The new `FadeScroll` (`DuskPrimitives.tsx`) sets each edge to 16dp only while content lies past it. It replaces every ScrollView in `TunnelApp.tsx` and `SingularityPanel.tsx`.
- Under-mode Tunnel button: back to the shared rounded-rectangle radius. The pill was an unrequested match to the rail.
- Tap latency (suspected, not confirmed): the composer built new native-driven `Animated.multiply`/`add` nodes on every render of `TunnelApp`. They are now built once.
- Windows "localhost refused": the release exe embeds the frontend (asset keys are present; the debug exe has none). The Start Menu `Tunnel.lnk` targets `target/debug/tunnel-desktop.exe`, a dev build that loads `localhost:1427`. Retargeting it was denied to the agent, so the user must retarget it.

Verification: mobile typecheck passes. No build, launch or visual test.

## 2026-11-01 — Windows release build command

No runtime change. Confirmed root `npm run build` dispatches the Windows native release with `--no-bundle`, replacing `target/release/tunnel-desktop.exe`. Explained that Windows Search needs a Start Menu shortcut pointing at that stable executable; subsequent builds update the same target. Quit Tunnel from its tray before rebuilding to release the executable lock. No build or app launch performed; no tests apply to this command lookup. Human check: build, then launch through the shortcut; expect the latest local source. Existing H12–H15 remain pending; no new product scope selected.

## 2026-11-01 — Dusk review round 2

Fixed the user's second Dusk review list:
- Android: taller tab bar; shorter fading edges; fixed History controls; mint Under-mode Tunnel button; redesigned horizontal rail (round thumb, centered label, no dots, eased motion).
- Android send animation: the user's video showed the draft lingering at 10% opacity, then the empty state snapping in. Now the composer fades fully (700ms, ease in-out) and the next state eases in (420ms); failure eases back.
- Desktop: fixed History and Singularity controls with only the list scrolling; dark file tiles; status dot plus small arrow at the bottom-left of History cards; larger grid photo previews; photos take one slot (`apps/desktop/src/layout.ts`); spaces cards align top-left; 14px search text.
- Desktop viewer loading (`src-tauri/src/server.rs`, `App.tsx`): full previews have their own 2-permit queue instead of waiting behind thumbnails; originals up to 12 MiB in common formats pass through without re-encoding; opaque images encode as JPEG instead of PNG; thumbnails are 640px; failures show a message and fall back to the thumbnail; neighbors preload.

Updated [Dusk handoff](design/dusk-handoff.md) and status (H15). Verification: 42 tests, desktop and mobile typechecks, desktop `vite build` and `cargo check` pass. Logs: `.tools/dusk-fix2-{test,vite,cargo}.log`. No launch or visual testing. Human next: rebuild both apps and run H15.

## 2026-11-01 — Dusk fixes and polish

Fixed the user's Dusk review list on Windows and Android:
- Phone nav: no selection block; the selected tab is bold and mint. The tab bar color runs under the gesture bar.
- Photo viewer on both platforms: fits the photo and uses most of the viewport (desktop loads a new 2400px `preview_attachment` `full` preview). The band order is index, arrows, copy. No X; dismiss by clicking outside, Escape or Back. Adds a close animation. Copy shows a quick toast (Android `ToastAndroid`) instead of in-print text.
- Composer photo stacks are larger, and much larger when the draft is only photos. A quanta with one photo gets direct Copy instead of download-all.
- Singularity: the phone swipe now drags the card over a mint Tunnel layer and animates the send. The search field matches the Quanta/Spaces control height on both platforms.
- Settings: the last phone row has no separator. Desktop Linked devices is regridded (name across the top, pairing and guide as equal cards). Phone devices spacing is adjusted.
- Android sharpness: suspected causes were the rail clipping (`overflow: hidden` on a rounded border) and the −0.5° front-print tilt. Removed both, added hardware layers on rotated prints and capped the rail burst at 1.5× so it stays inside the rail.
- Scroll areas fade at the edges: desktop scroll-driven masks; Android `fadingEdgeLength`.
- Desktop History and Singularity use a dense auto-fill grid. Slots are sized by `apps/desktop/src/layout.ts`; the Tunnel page is unchanged. The viewer modal covers the Android navigation bar.

Updated [Dusk handoff](design/dusk-handoff.md) and status (H14). Verification: 42 tests in nine files, desktop and mobile typechecks, desktop `vite build` (the fade and grid rules are present in the bundle) and `cargo check` pass. Logs: `.tools/dusk-fix-{test,vite,cargo-check}.log`. Native release builds were not rerun. No launch, install or visual testing. Human next: rebuild both apps and run H14.
