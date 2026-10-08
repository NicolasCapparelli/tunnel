import { type AuroraColor, type AuroraDimension, type AuroraFontFamily, type AuroraStrokeStyle, type AuroraTexture, type AuroraThemeVariant } from '@aurora/core';
export interface AuroraCssOptions {
    /** Custom property prefix without dashes. Defaults to `aurora`. */
    prefix?: string;
}
/** Ordered `--name` to value declarations. */
export type AuroraCssDeclarations = Readonly<Record<string, string>>;
/**
 * The custom property name for a token path: `--{prefix}-{segments joined by
 * "-"}`, keeping each segment's case. `colors.onPrimaryContainer` becomes
 * `--aurora-colors-onPrimaryContainer`. Path segments never contain `-`, so
 * names are unique per path.
 */
export declare function auroraCssName(path: string, options?: AuroraCssOptions): string;
/** `#rrggbb` when opaque, otherwise `#rrggbbaa`. */
export declare function cssColor(color: AuroraColor): string;
/** `dp` and `px` are both CSS pixels (1dp = 1px); `rem` is kept. */
export declare function cssDimension(value: AuroraDimension): string;
export declare function cssFontFamily(value: AuroraFontFamily): string;
/** The CSS `border-style` for a stroke; dash patterns become `dashed`. */
export declare function cssStrokeStyle(value: AuroraStrokeStyle): string;
/**
 * CSS custom properties for a resolved variant plus an optional texture.
 *
 * Colours: one variable per token. Texture tokens:
 * - dimension: `12px` (dp and px) or `1.5rem`; number: plain number
 * - fontFamily: quoted names, generic families unquoted; fontWeight: number
 * - duration: `200ms`; cubicBezier: `cubic-bezier(x1, y1, x2, y2)`
 * - strokeStyle: a `border-style` keyword (dash patterns become `dashed`, with
 *   `-dashArray` and `-lineCap` variables for SVG or canvas use)
 * - border: the `border` shorthand, plus `-width`, `-style` and `-color`
 * - shadow: the `box-shadow` list, or `none`
 * - typography: the `font` shorthand, plus `-fontFamily`, `-fontSize`,
 *   `-fontWeight`, `-letterSpacing` and `-lineHeight`
 * - boolean: `1` or `0`; enum: the value
 *
 * Theme colour references inside textures resolve against [variant]. Results
 * are cached per variant, texture and prefix, so repeated calls are cheap.
 */
export declare function auroraCssVariables(variant: AuroraThemeVariant, texture?: AuroraTexture, options?: AuroraCssOptions): AuroraCssDeclarations;
/** The declarations as a CSS rule, such as `:root { --aurora-colors-primary: #6750a4; ... }`. */
export declare function auroraCssText(selector: string, declarations: AuroraCssDeclarations): string;
/**
 * Writes [next] to [element]'s inline style, touching only variables whose
 * value changed and removing ones [previous] had that [next] lacks.
 */
export declare function applyAuroraCssVariables(element: {
    style: CSSStyleDeclaration;
}, next: AuroraCssDeclarations, previous?: AuroraCssDeclarations): void;
