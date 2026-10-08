# Status

## Current state

Personal development V1 implements local encrypted bidirectional text, QR pairing, composer/paste/upward rail, bounded searchable history, auto-copy and Aurora themes. Windows native listener persists in tray; Android receives while foreground. Attachments, account auth, remote networks, macOS/iOS and Android background receipt remain incomplete scope, not advertised features. Desktop storage is locally readable.

## Active work and last stopping point

2026-10-08: source and local tooling moved to `C:/Users/cappa/Desktop/Projects/tunnel`; provided Continuity initialized; CLI output paths updated. Authorized delivery is [current roadmap item](planning/roadmap.md#current-authorized-delivery). Standalone desktop release build, typechecks, nine shared tests and Android Hermes export pass from the moved checkout. Regenerated Android arm64 debug compilation also passed. V1 is ready for the authorized initial GitHub publication; Git history and origin/main track publication. No active product implementation remains. Earlier stopping point was usable V1 with native/emulator evidence; no additional next product task was selected. Prior human acceptance is not known.

## Pending human checks

All pending; automated success does not close them. User requested no manual/visual testing by agents unless explicitly authorized.

- H1: run the desktop exe, close its window, then open from tray. Expected: listener remains alive and window reopens.
- H2: run Android through CLI on a physical phone, pair by camera QR on same Wi-Fi, send both ways. Expected: sender gets receipt, receiver gets exact text in history/clipboard.
- H3: click a Windows receipt notification. Expected: UI opens history. Verify firewall onboarding, sleep/wake and adapter changes; expected reconnect without data loss.
- H4: enable login startup and exercise Ctrl+Shift+Space. Expected: tray startup and window opening; conflicts should surface.
- H5: assess gesture/keyboard/appearance comfort, long text and soft dark surfaces. Expected: cancellation keeps draft, confirmed sends clear unchanged draft, layout stays usable.

Procedures and historical evidence: [verification](../docs/verification.md), [implementation log](implementation-log.md).

## Blockers and open questions

No known source relocation or compilation blocker. Optional documentation-mode decision (full migration versus keep both) and design board creation are pending/deferred, independent of initialization. Existing root README and docs/verification remain. Dependencies have inherited build-chain advisories described in retained verification. Android direct build/install and desktop hot-reload launch are left unexecuted during this turn per testing preference.

## Last verified state

Earlier source before relocation: 9 shared tests, 3 Rust tests, 5 browser tests, desktop installer/native Android builds and emulator/native exchange passed, as recorded in [historical verification](../docs/verification.md). Those observations are not new tests of the moved checkout. Moved checkout on 2026-10-08: npm ci, desktop release build (target/release/tunnel-desktop.exe), desktop/mobile typechecks, 9 shared tests and Android Hermes export passed. Android native files regenerated at the new path; arm64 debug assembleDebug passed (no device install/launch). No manual/visual app tests were performed during this move. Documentation link/source/routing review is tracked in [initialization evidence](history/documentation/initialization.md).
