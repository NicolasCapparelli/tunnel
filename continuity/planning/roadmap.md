# Roadmap

## Current authorized delivery

Selected by user 2026-10-08: move all code to the desktop Projects/tunnel folder, initialize provided Continuity, expose CLI desktop/Android iteration without installers, and commit/push V1 to NicolasCapparelli/tunnel. Acceptance: code located there; standalone desktop exe at target/release/tunnel-desktop.exe; Android Expo build/run command documented; Continuity initialized; remote V1 pushed. Local deliverables and compilation checks are complete; V1 publication is the final authorized step, tracked by Git history/origin. This delivery does not authorize manual/visual testing.

## Current feedback implementation

Selected by user 2026-10-08 after trying V1: compact copy, rotating composer prompts, received-first history, cross-device names, desktop sidebar/send/history/receipt animation and notification repair, mobile flick/Back/background receipt, easier sharing, matching atom icon and a standalone Android CLI workflow. This supersedes the original desktop rail and Android foreground-only constraints. These changes are implemented locally; native/OS behavior awaits user review. Subsequently the user selected attachments and instant sharing below.

## Later direction

User-selected product direction from V1 discussion: differing networks/cellular as a fast followup after local speed; macOS after Windows/Android; auth later; attachments after text. Implementation order beyond these broad preferences and exact acceptance are not selected. Remote transport depends on authenticated routing/discovery and receipt semantics; macOS needs lifecycle/notifications verification. The subsequent attachment/instant-share item below establishes the current implemented delivery.

## Attachments and instant sharing

Selected and authorized by user 2026-10-08: bilateral images/files with optional notes; Android selected-text Tunnel action; raw text shares send without opening the composer; settings choose instant/review independently by quanta type. Initial scope used eight files/5 MiB aggregate (superseded by the refinement below), private persisted files, history previews/export/retry and native Android queued sharing. Text instant on, image/file instant off by default. UI/native implementation is complete locally, automated final builds pass; physical device behavior remains unverified and owned by the user. The subsequent refinement implements larger streamed files; resumable files, recording and iOS background sharing remain unselected extensions.

## Composer, media and delivery refinement

Selected by user 2026-10-08: raise attachment capacity; internal composer carousel; momentum completion/reset; smaller empty copy; coherent media history; desktop compact recent controls, image clipboard, selectable text, Copy/Save/expand, global Ctrl+Enter and aligned columns; mobile padding, notifications, icon sizing, configurable rail/button, Save Name feedback, fast menu, true image saving and clickable receipt feedback. Implemented with native 250 MiB/32-file encrypted chunk streaming, new high-importance Android receipt channel and viewport arrival animation. Standalone builds and automated checks validate compilation/protocol, with manual behavior left to the user. Commit/push is explicitly authorized for this delivery.

The user also requests brainstorming remote and more-than-two-device local transfers and route selection after publication. [Proposal](network-transfers.md) records recommendations and unresolved choices; no remote backend, accounts or multi-peer protocol implementation is authorized yet.

## Slower motion and local multi-desktop sharing

Selected and authorized 2026-10-10 after UI review: slower send/receipt/rail motion, horizontal rail particles, desktop equal filter/search width, centered expand dialog and bounded viewport layout. Then implement one phone to multiple desktops, prioritizing Windows and Mac over phone-to-phone. Local implementation now adds independent desktop pairings/connections, explicit persisted multi-selection, per-recipient history/receipts/retry and background instant-share routing. Native Mac build dispatch is included; Mac compilation/runtime and all new manual behavior remain pending user verification. Existing desktop listeners retain one-phone identity; no hub, remote relay/auth, phone-to-phone or discovery is implemented. This selection supersedes prior statements that all multi-device work was proposal only.

## Singularity shared space

Selected and authorized 2026-10-30: add an account-owned shared space that all of the user's devices can access independently of device pairing. It has a chronological searchable raw-quanta stream and user-organized structured spaces/entries (projects or other groupings). Use Entanglement realtime mode and Cloudflare. Cloudflare Access Managed OAuth is the identity path; Cloudflare Workers Free/SQLite Durable Objects provide the backend. Implemented for Windows/Android: sign-in/PKCE, platform credential vaults, account-isolated local SQLite, raw text append/search, space and entry create/search, offline local database access, realtime sync, setup guide. Remaining for acceptance: deploy/configure against the user's Cloudflare account; manually verify login callbacks, CORS, offline behavior and cross-device sync. Attachment storage, structured item editing/deletion and collaboration with other accounts are unimplemented. Review on 2026-10-30 clarified these delivery limits; the broad original completion claim did not establish them as finished.

## Dusk shell migration

Selected and authorized 2026-10-31: implement [the Dusk handoff](../design/dusk-handoff.md) in Windows and Android, with one GPT 6.1 Sol Medium agent on desktop and the primary agent on mobile/shared themes. Local implementation covers navigation/settings pages, photo stacks/viewer, still dots/triggered sheen, history icons, Singularity grids/actions/menus/pinned composers and space creation. Preserve Axis, Aurora's three themes/one contract, paired delivery, auth and sync. Automated verification and native release builds are the agent checks; the user owns visual/device acceptance. H13 records the new shell review; existing H12 remains the account/sync acceptance check. No Cloudflare deployment or remote-transfer work is selected by this migration.

## Mobile camera and OCR composer

Selected and authorized 2026-11-01: mobile-first camera capture and OCR on the Tunnel page, with four icon buttons in order Attach, OCR, Camera, Paste and increased button height. Android implementation uses 60 dp buttons, Expo Camera capture and a bundled on-device Latin-script ML Kit recognizer. Camera adds a private photo attachment; OCR appends editable text while preserving the existing draft. Both require an explicit later send. Acceptance: permission/cancel/retry, blank recognition, mixed drafts, limits, restart persistence, paired sending and narrow layouts/rail modes (H16). Desktop and iOS OCR are not selected for this delivery. Follow-up selected and authorized 2026-11-01: remove the viewport-wide shutter flash from both modes and add an OCR crop review. Implemented: full-image default; free corner resize/move; Reset, Retake and Continue; recognition only after Continue, of the selected area or the entire image when unchanged. Aurora surfaces/controls and accessible adjustment actions remain. H17 tracks device/visual acceptance. Final user review on 2026-11-01 selected removal of the crop-mask seam and adjacent, right-aligned, visually distinct Retake/Reset icon buttons. Implemented with one SVG mask and Camera/Scan icons. The user authorized committing and pushing all accumulated Tunnel work in logical commits, then closing this workstream; no further implementation is selected.
