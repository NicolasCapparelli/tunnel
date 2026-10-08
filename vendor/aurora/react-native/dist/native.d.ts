import { type AuroraBorder, AuroraColor, type AuroraCubicBezier, type AuroraDimension, type AuroraDuration, type AuroraRef, type AuroraShadow, type AuroraStrokeStyle, type AuroraThemeVariant, type AuroraToken, type AuroraTypography } from '@aurora/core';
/** One Aurora feature React Native cannot render faithfully. */
export interface AuroraNativeUnsupported {
    /** The token path when known (for example `border.card.style`), else the converted field. */
    readonly path: string;
    /** A stable identifier such as `strokeStyle.double` or `strokeStyle.dashArray`. */
    readonly feature: string;
    /** What is unsupported and what `report` mode substituted. */
    readonly message: string;
}
/** Thrown in `strict` mode (the default) when a value uses a feature React Native cannot render. */
export declare class AuroraNativeUnsupportedError extends Error {
    readonly unsupported: readonly AuroraNativeUnsupported[];
    constructor(unsupported: readonly AuroraNativeUnsupported[]);
}
/** The best-effort style plus what could not be represented. */
export interface AuroraNativeResult<T> {
    readonly style: T;
    readonly unsupported: readonly AuroraNativeUnsupported[];
}
export type AuroraNativeMode = 'strict' | 'report';
/** Options for conversions that can hit unsupported features. */
export interface AuroraNativeOptions {
    /** `strict` (default) throws {@link AuroraNativeUnsupportedError}; `report` returns {@link AuroraNativeResult}. */
    mode?: AuroraNativeMode;
    /** Names the converted token in unsupported reports, such as `border.card`. Defaults to the value type. */
    path?: string;
    /** The root font size in dp that `rem` lengths multiply by. Defaults to 16. */
    remBase?: number;
}
/** The return type for options `O`: plain style in strict mode, a result in report mode. */
export type AuroraNativeOutput<T, O> = O extends {
    readonly mode: 'report';
} ? AuroraNativeResult<T> : O extends {
    readonly mode: 'strict';
} ? T : 'mode' extends keyof O ? T | AuroraNativeResult<T> : T;
/**
 * A React Native colour string: `#rrggbb` when opaque, otherwise `#rrggbbaa`.
 * Alpha is preserved. (React Native reads `#rrggbbaa` with alpha last, like CSS.)
 */
export declare function nativeColor(color: AuroraColor): string;
/** The colour with its alpha replaced by [alpha] in [0, 1] (not multiplied), as a native colour string. */
export declare function nativeColorWithAlpha(color: AuroraColor, alpha: number): string;
/** Options for length conversion. */
export interface AuroraNativeLengthOptions {
    /** The root font size in dp that `rem` lengths multiply by. Defaults to 16. */
    remBase?: number;
}
/**
 * A length in React Native density-independent units. `dp` and `px` both map 1:1
 * (a CSS px is a dp in React Native, which has no separate device pixels in
 * style); `rem` multiplies by `remBase` (default 16).
 */
export declare function nativeDimension(dimension: AuroraDimension, options?: AuroraNativeLengthOptions): number;
/** `{ borderRadius }` for a radius dimension. */
export declare function nativeBorderRadius(radius: AuroraDimension, options?: AuroraNativeLengthOptions): {
    borderRadius: number;
};
/** Milliseconds (may be fractional, since durations keep microsecond precision). */
export declare function nativeDuration(duration: AuroraDuration): number;
/** Plain cubic-bezier control points, for `Easing.bezier(x1, y1, x2, y2)` in Reanimated or `Animated`. */
export interface AuroraNativeCubicBezier {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
}
export declare function nativeCubicBezier(curve: AuroraCubicBezier): AuroraNativeCubicBezier;
/** What React Native can draw as a line: `solid`, `dashed`, `dotted`, or nothing. */
export type AuroraNativeStrokeStyle = 'solid' | 'dashed' | 'dotted' | 'none';
/**
 * The React Native line style for a stroke. `solid`, `dashed` and `dotted` map
 * directly and `none` stays `none`. Unsupported: `double`, `groove`, `ridge`,
 * `outset`, `inset`, custom dash patterns and line caps; best-effort is `solid`.
 */
export declare function nativeStrokeStyle<O extends AuroraNativeOptions = {}>(style: AuroraStrokeStyle, options?: O): AuroraNativeOutput<AuroraNativeStrokeStyle, O>;
/** The border style fields of a React Native `ViewStyle`. */
export interface AuroraNativeBorderStyle {
    borderWidth: number;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
}
/**
 * `borderWidth`, `borderColor` and `borderStyle` for a border. The colour (a
 * literal or a theme colour alias) is resolved against [variant]. A `none`
 * stroke becomes `{ borderWidth: 0 }` with no colour or style. Stroke styles
 * React Native cannot draw are unsupported (see {@link nativeStrokeStyle}).
 */
export declare function nativeBorder<O extends AuroraNativeOptions = {}>(border: AuroraBorder, variant: AuroraThemeVariant, options?: O): AuroraNativeOutput<AuroraNativeBorderStyle, O>;
/** One entry of a React Native `boxShadow` (New Architecture, RN 0.76 and later). */
export interface AuroraNativeBoxShadow {
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadDistance: number;
    color: string;
    /** Present (true) only for inset shadows. */
    inset?: boolean;
}
/** The `boxShadow` field of a React Native `ViewStyle`; empty for `AuroraShadow.none`. */
export interface AuroraNativeShadowStyle {
    boxShadow: readonly AuroraNativeBoxShadow[];
}
/**
 * Maps each shadow layer to a `boxShadow` entry, in order: offsets, blur as
 * `blurRadius`, spread as `spreadDistance`, `inset`, and the colour resolved
 * against [variant]. Every Aurora shadow is representable.
 */
export declare function nativeShadow(shadow: AuroraShadow, variant: AuroraThemeVariant, options?: AuroraNativeLengthOptions): AuroraNativeShadowStyle;
/** React Native's string font weights. */
export type AuroraNativeFontWeight = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
/** Picks the font family name for a weight; return undefined to use the first family. */
export type AuroraNativeFontFamilyResolver = (families: readonly string[], weight: number) => string | undefined;
export interface AuroraNativeTypographyOptions extends AuroraNativeOptions {
    /**
     * Chooses the registered family for a weight. Android selects custom-font
     * weights by family name, so apps that load one family per weight map
     * `(['Inter'], 700)` to `'Inter-Bold'` here. Default: the first family.
     */
    fontFamilyResolver?: AuroraNativeFontFamilyResolver;
}
/** The text fields of a React Native `TextStyle`. */
export interface AuroraNativeTypographyStyle {
    fontFamily: string;
    /** dp. */
    fontSize: number;
    fontWeight: AuroraNativeFontWeight;
    /** Absolute dp (React Native has no multiplier): Aurora's multiplier times `fontSize`. */
    lineHeight: number;
    /** dp. */
    letterSpacing: number;
}
/**
 * Typography as React Native text style fields. Font size and letter spacing are
 * dp (rem uses `remBase`). Aurora's line height is a multiplier of the font size
 * and is converted to absolute dp. Weights must be 100..900 in steps of 100;
 * others are unsupported (best-effort rounds to the nearest step). Only the
 * first font family is used unless `fontFamilyResolver` picks one; React Native
 * has no font fallback list. Loading fonts is the app's job.
 */
export declare function nativeTypography<O extends AuroraNativeTypographyOptions = {}>(typography: AuroraTypography, options?: O & AuroraNativeTypographyOptions): AuroraNativeOutput<AuroraNativeTypographyStyle, O>;
/** Native conversions of texture tokens, with colours resolved against the active variant. */
export interface AuroraNativeTextureReader {
    /** A texture or theme colour reference as a native colour string. */
    color(ref: AuroraRef<AuroraColor>): string;
    dimension(token: AuroraToken<AuroraDimension>, options?: AuroraNativeLengthOptions): number;
    borderRadius(token: AuroraToken<AuroraDimension>, options?: AuroraNativeLengthOptions): {
        borderRadius: number;
    };
    duration(token: AuroraToken<AuroraDuration>): number;
    cubicBezier(token: AuroraToken<AuroraCubicBezier>): AuroraNativeCubicBezier;
    strokeStyle<O extends AuroraNativeOptions = {}>(token: AuroraToken<AuroraStrokeStyle>, options?: O): AuroraNativeOutput<AuroraNativeStrokeStyle, O>;
    border<O extends AuroraNativeOptions = {}>(token: AuroraToken<AuroraBorder>, options?: O): AuroraNativeOutput<AuroraNativeBorderStyle, O>;
    shadow(token: AuroraToken<AuroraShadow>, options?: AuroraNativeLengthOptions): AuroraNativeShadowStyle;
    typography<O extends AuroraNativeTypographyOptions = {}>(token: AuroraToken<AuroraTypography>, options?: O): AuroraNativeOutput<AuroraNativeTypographyStyle, O>;
}
/** @internal Used by the texture view; unsupported reports default their path to the token path. */
export declare function createNativeTextureReader(read: <T>(token: AuroraToken<T>) => T, variant: AuroraThemeVariant): AuroraNativeTextureReader;
