# @aurora/react

React 19 adapter for Aurora, the web counterpart of `aurora_flutter`'s
controller, scope and engine (no Material bridge; CSS custom properties take its
place).

- `AuroraController`: owns or borrows an `AuroraRuntime` and notifies
  synchronously after accepted changes.
- `AuroraProvider`: provides a controller (borrowed via `controller`, or created
  and disposed from runtime options), follows `prefers-color-scheme`, and writes
  CSS variables to its wrapper element or `:root`.
- `AuroraFixedScope`: a controller-free scope for previews and thumbnails, with an
  imperative `update()` handle for per-frame changes.
- Hooks: `useAuroraTokens`, `useAuroraVariant`, `useAuroraTexture`,
  `useMaybeAuroraTexture`, `useAuroraToken`, `useAuroraController`,
  `useAuroraState`, `useAuroraScope`.
- `auroraCssVariables`, `auroraCssText`, `applyAuroraCssVariables`: the pure CSS
  emitter, usable outside React.

`react` ^19 and `@aurora/core` are peer dependencies; the app provides both, so
there is exactly one `@aurora/core` instance (token identity depends on it). Private;
see `continuity/user/typescript.md` in the Aurora repository.
