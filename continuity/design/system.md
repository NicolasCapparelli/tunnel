# Design system

## Accepted language

User-provided seed layout: title/menu header; large central editable quanta; adjacent upward rail to send without a conventional button; attachment and clipboard actions below; history and pairing on separate pages. Orbit/particle motifs, send motion and restrained typography express tunneling. Attachment is honestly marked Soon while V1 carries text. Keyboard/accessibility send actions supplement the gesture.

[Runtime themes](../../packages/shared/src/theme.ts) own Mineral sage/teal, Dune warm sand and Tide cool blue, each with light/dark variants and system selection. Mineral light is the default. Dark surfaces are softened green slate, avoiding near-black. Theme switching preserves draft/navigation. Exact colors belong in source, not screenshots.

## Composition and primitives

[Web CSS](../../apps/desktop/src/style.css) owns typography, spacing, rounded composer, rail, navigation, cards and feedback using Aurora CSS roles. DM Sans provides interface text, Instrument Serif the identity/editorial accent; fonts ship locally. [Mobile token mapping/styles](../../apps/mobile/src/TunnelApp.tsx) mirrors the same semantic hierarchy with native components. Web/native rails own gesture progress, cancellation and accessible actions. Mobile adds haptics and reduced-motion handling; web uses reduced-motion CSS.

States include disconnected/connecting/connected, empty/ready composer, sending, delivered/failed history, QR expiry, revoked link and clipboard errors. Connection/receipt feedback must remain accurate. [Theme tests](../../tests/theme.test.ts) cover completeness/readability; automated checks do not establish user comfort or actual OS interaction. Earlier visual observations are historical [verification](../../docs/verification.md), with new visual assessment left to the user.
