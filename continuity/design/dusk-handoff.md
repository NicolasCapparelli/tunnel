# Dusk shell handoff

Nico asked for the running Windows and Android UI to follow the Dusk study. The visual spec is [dusk.html](dusk.html). Read that page before editing screens. This note says which behaviors the mock fixes, and which product work stays put.

The Windows and Android shells were migrated on 2026-10-31. Use this brief to review the implementation and guide later refinements. Native builds and automated checks do not establish visual acceptance. Do not treat the mock’s studio chrome (the sticky Dusk bar, the Phone and Desktop captions, or the page tabs) as part of the app. Those controls only switch the study.

## Read first

Follow [agent instructions](../agent/instructions.md). Read [status](../status.md) and [the map](../agent/map.md). For visuals, read [design](README.md) and [the language](system.md). Status still stops on Singularity sign-in and sync (H12). This migration does not replace that stopping point and does not change Cloudflare, Entanglement, pairing, or the protocol.

Serve the study from `continuity/design` and open `http://127.0.0.1:<port>/dusk.html`. A `file://` URL hides the page from the browser tools. Hashes: `#tunnel`, `#draft`, `#history`, `#singularity`, `#spaces`, `#settings`, and `#settings-look`, `#settings-share`, `#settings-account`, `#settings-arrival`, `#settings-devices`. `#devices` opens Settings on Linked devices.

Leave manual and visual checks of the running app to Nico. Do not launch Tunnel, an emulator, or the installed app. Typecheck and unit tests are fine. Automated UI tests run only if Nico authorizes them for that task.

## What stays

- The Axis launcher. Construction is [axis.html](axis.html). The mark in the study is the existing Tide split: left `#376682`, right `#e4ebef`. Do not redraw it.
- Pairing, crypto, the wire protocol, history storage, attachment limits, Cloudflare Access, and Entanglement sync.
- Mineral, Dune, and Tide, and Light / Dark / System. The study is drawn in Dusk and its Appearance buttons do not recolor the preview. In the app, choosing a theme still changes the surfaces. Use the Dusk hexes below as the dark shell. Do not delete the three themes or add a fourth named theme unless Nico asks.
- Sample copy in the study (the gate, the slides, `ngcsrp@gmail.com`, Studio PC, MacBook, Pixel 9) is fixture content, not data to hardcode.

## Where to change the shells

Phone: [TunnelApp.tsx](../../apps/mobile/src/TunnelApp.tsx), [SendRail.tsx](../../apps/mobile/src/SendRail.tsx), [SingularityPanel.tsx](../../apps/mobile/src/SingularityPanel.tsx).

Windows: [App.tsx](../../apps/desktop/src/App.tsx), [style.css](../../apps/desktop/src/style.css), [SingularityPanel.tsx](../../apps/desktop/src/SingularityPanel.tsx).

Theme tokens: [theme.ts](../../packages/shared/src/theme.ts), applied from the desktop provider and [App.tsx](../../apps/mobile/App.tsx) on Android. Map semantic surfaces onto the shell colors. Keep one shared theme contract.

Dusk shell, from the study’s `:root`:

| Token | Hex |
| --- | --- |
| Studio surround | `#101318` |
| App background | `#3e4d60` |
| Deep | `#314052` |
| Sidebar | `#2c3a4b` |
| Card | `#4a5c72` |
| Inset | `#2a3849` |
| Ink | `#f4f8fc` |
| Muted | `#c5d2e0` |
| Faint | `#93a6ba` |
| Mint | `#6fe0c2` |
| On mint | `#102e28` |
| Danger | `#ffb4ab` |

Type is DM Sans. Quanta body text sits on `#46586e` so a swipe layer does not show through at rest. Photo prints are cream `#f7f5f1`, padded `5px 5px 14px` (mini `3px 3px 8px`), with a print radius near 5px.

## Shell

Phone width is 390. The frame grows with the page; do not clip a page to 844. The bottom bar has four equal columns: Tunnel, History, Singularity, Settings. Spaces is inside Singularity, not a fifth tab. Linked devices is a Settings row, not a tab.

The selected tab has no block or pill behind it. Its icon and label turn bold and mint; other tabs stay muted. The tab bar's deep color continues under the Android gesture bar, so there is no separate band below it.

Desktop keeps a sidebar and a Recent column on Tunnel. Sidebar width is 220, and 76 when collapsed. There is no separate collapse control. Clicking the Tunnel logo expands and collapses it. Collapsed state keeps the icons and hides the word Tunnel, the nav labels, and the footer label. The side label is Settings.

Search fields stay inside the frame. The desktop composer and the Recent search must not spill past the window.

## Tunnel

Compare `#tunnel` and `#draft`.

- No “Tunnel” title on the phone page. The Linked pill sits on the device row, at the trailing end. Desktop puts the same pill on the “To” line.
- Empty copy stays “Ready to stochastically appear somewhere else?”
- The phone keeps the right-hand slide-to-send rail: 56px wide, radius 22, spanning the composer and Attach / Paste. The handle is 34×48, radius 20. Empty is muted. A draft with content turns the rail mint. Desktop has no rail. It keeps the full-width Tunnel button and Ctrl+Enter.
- Image quanta are a stack of prints, not a horizontal carousel. Each print has its own cream frame. The front print sits straight (no tilt); a tiny tilt rendered as stair-stepped edges on Android. Back prints keep their fan angle. Nothing draws a plate around the whole stack. The count sits on the front print. Tapping the composer stack fans the prints. History opens the photo viewer. When the draft holds only photos, the stack is much larger and fills the composer.
- The dot field is one still lattice of pale dots (`rgba(244, 248, 252, 0.28)`). It does not drift. One upward sheen plays when the Tunnel page opens and when the rail is used. Reduced motion removes the sheen. On desktop the field covers the center column, not only the composer.

## History

- No Save or Share text bars.
- Copy is an icon at the bottom right of each quanta. A quanta with exactly one photo also gets Copy, which copies that photo.
- Several photos get a download-all icon (one photo gets Copy instead). Opening the stack shows one print in the photo viewer below. Copying that print copies the one on screen.
- Retry is a circular-arrow icon, aligned to the right.
- Desktop search stays inside the Recent column, with Received, Sent, and All.
- The desktop History page uses the same dynamic grid as Singularity (see Lists).

## Singularity

Compare `#singularity` and `#spaces`.

The stream is labeled Quanta. Account is only in Settings. The signed-out explanation points at Settings. It is not a card on this page.

The search field is the same height as the Quanta / Spaces control (48 on phone, 46 on desktop). Leave a clear gap between the Quanta / Spaces control and the search field. In the study that gap is 20px on one row, and the block below is separated by 16px.

Quanta actions:

- Phone: a short hold (about 380ms) copies. Movement past about 8px cancels the hold so the text can still be selected. A right swipe tunnels that quanta to the device selected on Tunnel. The card follows the finger over a mint “Tunnel” layer, flies out past 70px, and slides back once sent. Desktop does not use the hold. It shows a copy icon.
- The three-dot menu moves the quanta into a space. The menu must escape the card. A card with `overflow: hidden`, and a scrolling page, both clipped it. Open it from the button in a layer that is not clipped, upward when there is room and downward when the top edge would cut it off.
- The expand icon is two arrows pointing away from each other (one toward the top right, one toward the bottom left), not four corner brackets. It opens a dialog with the full quanta, on phone and desktop.
- There is no gesture-hint sentence.

Lists, on desktop only:

- The Quanta list is a dynamic grid of small slots (`repeat(auto-fill, minmax(220px, 1fr))`), so wide windows show more than two per row. A single full-width row is the bug this fixes.
- Slot size follows length (`apps/desktop/src/layout.ts`): normal quanta take one slot, long text or several photos span two columns, very long text spans two columns and two rows. Text clamps to its slot; expand shows the rest.
- The spaces list and an open space’s entries use the same grid, not a nested directory.
- Phone uses a two-column grid tailored to its width (`apps/mobile/src/layout.ts`). In History, photo-only quanta take one column, and two in a row share a row. Text, file and mixed quanta span both columns. Order is kept, so a photo quanta next to a wide one sits alone at half width. The cards in a pair match height; a half card hides the "N photos" label and keeps its header and status on one line. Singularity spaces pair two per row. Singularity quanta are text and stay full width. The Tunnel page keeps its own layout.
- Cards in a row share a height. The card surface fills that height. Do not let a colored swipe layer show in the leftover space.

Composer:

- One row: text field, then send. Both are 52px tall.
- Placeholder on the Quanta list: “A thought for every device”.
- Placeholder inside an open space: “Add quanta here”.
- The spaces list has no composer.
- On the phone, pin the row just above the tab bar.
- On desktop, pin it to the bottom of the frame with a 16px margin (`0 16px 16px` in the study). The list scrolls above it. This applies to both placeholders.

Spaces:

- A bottom-right button creates a space and opens a dialog. There is no inline name field on the list.
- That button hides once a space is open, on phone and desktop.
- “All spaces” is not a control. Choosing Spaces again returns to the list.

## Photo viewer

Opening a stack shows one print in the same cream frame and soft shadow as the prints in the stack. The print fits the photo’s own shape and uses most of the viewport (up to about 92% wide and 90% tall on desktop, which loads a 2400px preview), so tall photos are not shrunk into a fixed box. The cream band under the print is the only chrome, in this order: the `1/3` index at the left, previous and next in the middle, and a copy icon at the right. The index and arrows appear only with more than one photo. There is no close (X) icon and no filename. Click or tap outside the print to close; Escape and Android Back also close. The print eases up into place on open and drops away on close, and slides when the photo changes. Reduced motion removes those animations. On the phone, swipe left or right to change prints, and hold the print to copy. Copy confirmation is a short toast that disappears on its own (an Android system toast above the viewer), not text inside the print.

## Settings

Settings is a list. Each row opens its own page. Back is an arrow icon, with the accessible name Back.

- Phone rows include Share straight away, Appearance, Linked devices, and Account.
- Desktop rows include Appearance, When something arrives, Linked devices, and Account.
- Appearance includes the theme choices and Light / Dark / System. On desktop, center that Light / Dark / System control. The study centers a 360px-wide control in the card. Phone Appearance also contains Send control (Left, Right, Under). The study shows Right, matching the rail.
- Paste a pairing code is its own section on the phone’s Linked devices page, not a disclosure inside another card.
- Desktop Linked devices keeps the pairing code, the desktop name, and the short setup. The name card spans the top; the pairing card and the setup guide sit below as two equal-height cards (one column below 760px).
- The last row of a list has no separator line.

## Scrolling

Scroll areas end in a soft fade, not a hard cut. An edge fades only while more content lies past it. Desktop uses a scroll-driven CSS mask on the page, Singularity list, Recent list and composer attachments; Android uses the native fading edge on scroll views.

## Done when

A reader can put the running phone and the running Windows window next to `dusk.html` and match the layout above: device-row Linked status, quiet dot field, photo stacks, history icons, Quanta grids, unclipped move menu, pinned composers, logo collapse, centered appearance control, and the new-space button only on the spaces list. Axis, a paired send, and a signed-in Singularity sync still behave as they do today. Nico checks the look.

## Mobile capture extension (2026-11-01)

The user selected four equal icon buttons on the phone Tunnel page: Attach, OCR, Camera, Paste. They are 60 dp tall, use Aurora soft surfaces and retain accessible names. OCR opens a capture modal, then a crop review before recognition. The review starts with the full image selected; four corner handles resize freely and the interior moves the selection. Areas outside it are dimmed. Reset restores the full image, Retake returns to the camera, and the full-width Continue button recognizes the selected area and appends text to the existing note. An unchanged crop recognizes the full image. Both capture modes disable Expo’s root-view white shutter animation. The review follows Aurora surfaces/accents and existing rounded controls. Its outside dimming is one SVG mask to avoid seams; right-aligned icon buttons use Camera for Retake and a four-corner Scan frame for Reset, with accessible names. The user reviewed the crop UI and selected this final polish; the latest seam/icon device check remains pending under H17. Camera adds a captured photo to the existing attachment stack immediately after the shutter action. Neither sends automatically. Android uses bundled, on-device Latin-script recognition. The study and desktop retain their original Attach/Paste row. Device/visual acceptance is pending (H16).

## Review round 2 (2026-11-01)

- History (both platforms) and Singularity (desktop): the segmented control and search stay fixed; only the list scrolls.
- Scroll fades are short (16dp on Android, 14px on desktop) and appear only while more content lies past that edge. Android uses `FadeScroll` in `apps/mobile/src/DuskPrimitives.tsx`, because React Native draws a plain `fadingEdgeLength` at full strength even at the scroll limits.
- Phone tab bar has more top and bottom padding, so icons do not touch its top edge.
- Under mode's Tunnel button is mint with `onPrimary` bold text, 60 tall, and uses the same rounded-rectangle radius as Attach and Paste (not a pill).
- The horizontal rail is a 60-tall pill with a 46px round mint thumb and a centered "SLIDE TO SEND" label that fades as the thumb moves. No dots. The vertical rail keeps its dots.
- After a send, the composer fades out fully, then the empty state eases up into place (no snap).
- Desktop file tiles (PDF, video and similar) use a raised dark surface with ink controls.
- Desktop History cards: no leading direction badge. The bottom-left shows an 8px status dot (mint; muted when pending; error when failed) with a small direction arrow. Photo previews are larger. Photos and stacks take one grid slot.
- Desktop spaces cards align top-left.
- Desktop search and segmented text in History and Singularity use 14px and 13px.
- Phone Singularity's Quanta / Spaces switch is the same segmented control as History's filter (inset track, mint selected segment with bold `onPrimary` text).
- Phone History is a virtualized list (`FadeList`); only nearby cards mount.
- Desktop viewer: full previews use their own queue, pass small originals through unchanged, show an error when loading fails, and preload neighbors.
- Desktop shows no scrollbars anywhere; scroll edges fade instead.
- Desktop History grid cards keep download-all in the bottom action row, next to expand and copy, not beside the stack. Grid photo previews are 210×200, with 138×170 prints. File tiles in grid cards use a 64px art band. Card content rows grow to fit, so tiles never push into the meta line. Focus rings inside clipped tiles sit inset.
- Desktop settings and Linked devices: titles start at the left, after the back arrow. The heading and content share an 880px max width, centered in wide windows.
