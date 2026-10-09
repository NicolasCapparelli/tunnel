# Network and multi-device proposals

Discussion requested by the user 2026-10-08 after the media/UI refinements. This is a proposal, not implemented functionality or a selected provider.

## Sending interaction

Keep the quanta composer unchanged. Above it, show a destination chip with the named device and route indicator. Tap to select one or several trusted devices; retain the last destination and show connection/delivery state per device. Separate identity from reachability: an offline device remains selectable.

Use two policies: Automatic (prefer LAN, otherwise internet) and Local only (never upload; queue until locally reachable). Prefer a durable user preference with a visible per-quanta override rather than asking for a transport on every send. Avoid changing an already queued local-only quanta to internet automatically. Consider a confirmation only when enabling remote capability for the first time.

## More local devices

Replace the single-phone session with a trusted-device registry, individual credentials and receipt/status per recipient. QR pairing adds another device without replacing existing ones; authenticated discovery updates reachable addresses without re-trusting arbitrary LAN advertisements. Multi-select sends one logical quanta with separately tracked recipient deliveries and partial success/retry.

A desktop-as-hub phase reuses the current listener and supports several phones/desktops quickly, but phone-to-phone delivery depends on the hub being awake. A later direct mesh needs phone receiving/discovery as well; choose based on whether hub-free phone-to-phone is required immediately. Native LAN service discovery is an implementation candidate ([Android connectivity docs](https://developer.android.com/develop/connectivity/wifi)), with manual address fallback. Do not reuse one shared key for every device.

## Remote transfers

Recommended first phase: outbound TLS connections to a small routing relay with end-to-end per-recipient encryption. Store encrypted file blobs separately from routing envelopes, with bounded retention, expiry and deletion on receipt; relay-visible metadata should be limited. An encrypted expiring inbox can deliver after the recipient wakes. Distinguish queued/uploaded from recipient-confirmed in the UI; only a recipient receipt clears a draft as delivered.

QR trusts devices initially; remote routing still needs scoped device authentication and key revocation. Account login can later recover the registry, while device keys stay separate. No auth vendor or hosting provider has been chosen. A managed WebSocket service or self-hosted relay are possible; Cloudflare Durable Objects are one evaluated option ([WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)).

Direct WebRTC is a possible later optimization; signaling plus STUN/TURN adds another delivery path and relay fallback ([WebRTC peer connection docs](https://webrtc.org/getting-started/peer-connections)). Prefer a reliable encrypted relay first, then optimize large transfers where direct connectivity is available. Remote file streaming should add resumable chunks, integrity manifests, cancellation and progress before increasing capacity again.

## Decisions to discuss

- Should remote quanta wait in an encrypted inbox while the recipient sleeps, or require an online recipient? Proposed inbox expiry: 24 hours, configurable later.
- Should Automatic internet routing be the default once remote support is enabled, or should users opt into it per paired device?
- Is a Windows desktop hub sufficient for the first multi-device version, or is direct Android-to-Android required?
- Is self-hosting a near-term requirement? This affects deployment and account choices, not the composer.

No runtime change from this proposal. Multi-device and remote acceptance, auth provider and deployment remain unselected.
