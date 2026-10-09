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
