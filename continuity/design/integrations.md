# Design integrations

Tunnel uses Aurora; TokenSeed is not used. All three private Aurora packages are vendored at version 0.1.0 as one compatible snapshot, with one shared core resolution for web/native adapters.

Provenance and hashes: [manifest](../../vendor/aurora/vendor-manifest.json), [vendor notes](../../vendor/aurora/VENDORED.md). Source was the user's local Aurora checkout at `C:/Users/cappa/Desktop/Projects/aurora`. Export used existing built dist, without rebuilding or modifying Aurora; source revision/dirty state are unknown (null in manifest).

[Refresh helper](../../tools/vendor-aurora.py) calls the source checkout's exporter for core plus React and React Native. Preserve snapshot and review compatibility before refreshing, then npm ci, typecheck and theme tests. Compiled vendor dist is explicitly included in Git so fresh checkouts work. No separate UI token export or board was produced; Aurora Generator creates Tunnel's theme variants at runtime.

[Contract](../../packages/shared/src/theme.ts) is `tunnel.v1`. [Web provider](../../apps/desktop/src/main.tsx) exports root CSS variables; [native provider](../../apps/mobile/App.tsx) and nativeColor map roles to styles. Theme preference restoration constrains IDs/appearances. This adoption uses generated foundation roles and explicit surface overrides; it is not a copy of every Aurora starter/export mode. Exact supported role validation is owned by Aurora and the consuming tests, rather than a documentation token-count claim.
