# @aurora/react-native

The React Native adapter for Aurora. It is self-contained: it depends on
`@aurora/core`, `react` and `react-native` (only `Appearance` and types) and does
not import `@aurora/react`. There is no DOM, CSS, `window`, `document` or Node
code in it.

**Qualified combination:** React Native 0.86.3 with React 19.2.3. The peer ranges
(`react` `>=19.0.0 <20`, `react-native` `>=0.79.0`) are wider than what has been
tested. `boxShadow` output needs the New Architecture (React Native 0.76 or later).

Like the other packages it is private and reaches apps as a vendored snapshot;
`@aurora/core` is a peer dependency so the app keeps one copy (contract and token
identity depend on it).

## Public imports

```ts
import {
  // controller and provider
  AuroraController, AuroraProvider, AuroraFixedScope, systemAppearance,
  // hooks
  useAuroraScope, useAuroraVariant, useAuroraTokens, useAuroraToken,
  useAuroraTexture, useMaybeAuroraTexture, useAuroraController, useAuroraState,
  // native conversions
  nativeColor, nativeColorWithAlpha, nativeDimension, nativeBorderRadius,
  nativeTypography, nativeStrokeStyle, nativeBorder, nativeShadow,
  nativeDuration, nativeCubicBezier, AuroraNativeUnsupportedError,
} from '@aurora/react-native';
```

## Integration (Expo Router)

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuroraProvider } from '@aurora/react-native';
import { contract, themes, textures } from '../theme';

export default function RootLayout() {
  return (
    <AuroraProvider
      contract={contract}
      themes={themes}
      textures={textures}
      initialSelection={selection}
      fallback="preferred"
      onSystemAppearanceError={(error) => reportToMyLogger(error)}
    >
      <Stack />
    </AuroraProvider>
  );
}
```

`AuroraProvider` renders no native view, only a context provider, so theme changes
never remount the navigator. It follows the device appearance through
`Appearance.addChangeListener` (set `followSystemAppearance={false}` to stop), and
a rejected change (under the `reject` fallback) keeps the current state and goes
to `onSystemAppearanceError`, or `console.error` without it. Managed
configuration is fixed while mounted; give the provider a new `key` to replace it.
A `controller` prop borrows a controller you own and never disposes it.

A fixed scope themes a subtree with an immutable variant, for example a dark canvas
inside a light app. It needs no controller and renders no view:

```tsx
<AuroraFixedScope variant={theme.variants.get('dark')!} texture={texture}>
  <Canvas />
</AuroraFixedScope>
```

Its ref handle has `update(variant, texture?)` for per-frame changes.

Typed reads and conversions in a component:

```tsx
function Card() {
  const tokens = useAuroraTokens();              // foundation colours
  const ticket = useAuroraToken(ticketColor);    // app colour token
  const view = useAuroraTexture();               // texture bound to the variant
  const border = view.native.border(cardBorder); // { borderWidth, borderColor, borderStyle }
  const shadow = view.native.shadow(cardShadow); // { boxShadow: [...] }
  const heading = view.native.typography(headingType);
  return (
    <View style={[{ backgroundColor: nativeColor(ticket) }, border, shadow]}>
      <Text style={[heading, { color: nativeColor(tokens.onSurface) }]}>Hello</Text>
    </View>
  );
}
```

`view.native` converts texture tokens against the active variant, so colour
aliases (a border using `outlineVariant`) follow light and dark. The same pure
functions are exported for values you already hold; those that draw colours take
the variant: `nativeBorder(border, variant)`, `nativeShadow(shadow, variant)`.

## Conversions

| Aurora value | Native result | Notes |
| --- | --- | --- |
| Colour | `#rrggbb`, or `#rrggbbaa` when not opaque | Alpha preserved. `nativeColorWithAlpha(color, a)` replaces alpha with `a` in [0, 1]. |
| Dimension `dp`, `px` | number (dp) | Both map 1:1; a CSS px is a dp in React Native. |
| Dimension `rem` | number (dp) | Multiplied by `remBase` (default 16). Pass `{ remBase }` to change it. |
| Radius | `{ borderRadius }` | `nativeBorderRadius`. |
| Typography | `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` | `lineHeight` is Aurora's multiplier times `fontSize` in dp (absolute). Weight is the string `'100'` to `'900'`. |
| Font family | first name, or `fontFamilyResolver(families, weight)` | No fallback list in React Native. |
| Stroke `solid`, `dashed`, `dotted` | `borderStyle` | |
| Stroke `none` | `{ borderWidth: 0 }` | No colour or style emitted. |
| Border | `borderWidth`, `borderColor`, `borderStyle` | Colour alias resolved against the variant. |
| Shadow | `boxShadow: [{ offsetX, offsetY, blurRadius, spreadDistance, color, inset? }]` | Layers in order; `AuroraShadow.none` gives `[]`. |
| Duration | milliseconds (number) | |
| Cubic bezier | `{ x1, y1, x2, y2 }` | Feed `Easing.bezier(x1, y1, x2, y2)` (Reanimated or `Animated`). |
| Stroke `double`, `groove`, `ridge`, `outset`, `inset` | **unsupported** | Best effort: `solid`. |
| Custom dash pattern, line cap | **unsupported** | Reported as `strokeStyle.dashArray` and `strokeStyle.lineCap`. Best effort: `solid`. |
| Font weight not in 100..900 steps of 100 | **unsupported** | Reported as `fontWeight.step`. Best effort: nearest step, clamped. |

### Unsupported features are never silent

`nativeStrokeStyle`, `nativeBorder` and `nativeTypography` (and the matching
`view.native` methods) default to `mode: 'strict'` and throw
`AuroraNativeUnsupportedError`, naming the token path and feature in the message
and in `error.unsupported`. Pass `{ mode: 'report' }` to get the best-effort style
and the list instead:

```ts
const { style, unsupported } = view.native.border(cardBorder, { mode: 'report' });
// unsupported: [{ path: 'demo.lines.cardBorder.style', feature: 'strokeStyle.double', message: '...' }]
```

### Fonts

Loading fonts is the app's job (`expo-font`, `useFonts`, native linking). Aurora
only converts the names. Android selects custom-font weights by family name, so
apps that register one family per weight map them with a resolver:

```ts
const heading = view.native.typography(headingType, {
  fontFamilyResolver: (families, weight) =>
    families[0] === 'Inter' ? (weight >= 700 ? 'Inter-Bold' : 'Inter-Regular') : undefined,
});
```

`fontWeight` is still emitted; drop it from the style when the resolved family
already encodes the weight.

## Differences from `@aurora/react`

No CSS custom properties, wrapper element, `as` or `className`; the provider and
fixed scope render nothing of their own. The system appearance comes from
`Appearance`: only `dark` is dark, and `light`, `unspecified` and `null` are light.
