// Native style conversions: pure functions from Aurora values to React Native
// style data. Nothing here imports `react-native`, so the functions run anywhere.
//
// Unsupported features are deliberate, never silent. Conversions that can meet a
// feature React Native cannot draw (some stroke styles, fractional font weights)
// throw `AuroraNativeUnsupportedError` by default (`mode: 'strict'`). Pass
// `mode: 'report'` to get `{ style, unsupported }` instead, with a described
// best-effort style, and decide what to do with the list.
import { AuroraArgumentError, AuroraColor, resolveTextureColor, } from '@aurora/core';
/** Thrown in `strict` mode (the default) when a value uses a feature React Native cannot render. */
export class AuroraNativeUnsupportedError extends Error {
    unsupported;
    constructor(unsupported) {
        super(`Aurora value is not supported by React Native: ${unsupported
            .map((entry) => `${entry.path} (${entry.feature}): ${entry.message}`)
            .join('; ')}. Pass { mode: 'report' } to get a best-effort style plus the unsupported list.`);
        this.name = 'AuroraNativeUnsupportedError';
        this.unsupported = Object.freeze([...unsupported]);
    }
}
function finish(style, unsupported, options) {
    const mode = options.mode ?? 'strict';
    if (mode !== 'strict' && mode !== 'report')
        throw new AuroraArgumentError(`Unknown native mode ${String(mode)}`);
    if (mode === 'report')
        return { style, unsupported: Object.freeze(unsupported) };
    if (unsupported.length > 0)
        throw new AuroraNativeUnsupportedError(unsupported);
    return style;
}
// ---------------------------------------------------------------- colour
function hex2(value) {
    return value.toString(16).padStart(2, '0');
}
/**
 * A React Native colour string: `#rrggbb` when opaque, otherwise `#rrggbbaa`.
 * Alpha is preserved. (React Native reads `#rrggbbaa` with alpha last, like CSS.)
 */
export function nativeColor(color) {
    const rgb = `#${hex2(color.red)}${hex2(color.green)}${hex2(color.blue)}`;
    return color.alpha === 255 ? rgb : `${rgb}${hex2(color.alpha)}`;
}
/** The colour with its alpha replaced by [alpha] in [0, 1] (not multiplied), as a native colour string. */
export function nativeColorWithAlpha(color, alpha) {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
        throw new AuroraArgumentError(`Alpha must be between 0 and 1, got ${alpha}`);
    }
    return nativeColor(AuroraColor.rgba(color.red, color.green, color.blue, Math.round(alpha * 255)));
}
const DEFAULT_REM_BASE = 16;
/**
 * A length in React Native density-independent units. `dp` and `px` both map 1:1
 * (a CSS px is a dp in React Native, which has no separate device pixels in
 * style); `rem` multiplies by `remBase` (default 16).
 */
export function nativeDimension(dimension, options = {}) {
    if (dimension.unit !== 'rem')
        return dimension.value;
    const base = options.remBase ?? DEFAULT_REM_BASE;
    if (!Number.isFinite(base) || base <= 0)
        throw new AuroraArgumentError(`remBase must be positive, got ${base}`);
    return dimension.value * base;
}
/** `{ borderRadius }` for a radius dimension. */
export function nativeBorderRadius(radius, options = {}) {
    return { borderRadius: nativeDimension(radius, options) };
}
// ---------------------------------------------------------------- motion
/** Milliseconds (may be fractional, since durations keep microsecond precision). */
export function nativeDuration(duration) {
    return duration.milliseconds;
}
export function nativeCubicBezier(curve) {
    return Object.freeze({ x1: curve.x1, y1: curve.y1, x2: curve.x2, y2: curve.y2 });
}
const UNSUPPORTED_KEYWORDS = new Set(['double', 'groove', 'ridge', 'outset', 'inset']);
function strokeStyle(style, path, unsupported) {
    const keyword = style.keyword;
    if (keyword === undefined) {
        unsupported.push({
            path,
            feature: 'strokeStyle.dashArray',
            message: 'custom dash patterns cannot be set on a React Native border; best-effort uses solid',
        });
        unsupported.push({
            path,
            feature: 'strokeStyle.lineCap',
            message: `line cap '${style.lineCap}' cannot be set on a React Native border`,
        });
        return 'solid';
    }
    if (UNSUPPORTED_KEYWORDS.has(keyword)) {
        unsupported.push({
            path,
            feature: `strokeStyle.${keyword}`,
            message: `'${keyword}' borders are not available in React Native; best-effort uses solid`,
        });
        return 'solid';
    }
    return keyword;
}
/**
 * The React Native line style for a stroke. `solid`, `dashed` and `dotted` map
 * directly and `none` stays `none`. Unsupported: `double`, `groove`, `ridge`,
 * `outset`, `inset`, custom dash patterns and line caps; best-effort is `solid`.
 */
export function nativeStrokeStyle(style, options = {}) {
    const unsupported = [];
    const result = strokeStyle(style, options.path ?? 'strokeStyle', unsupported);
    return finish(result, unsupported, options);
}
/**
 * `borderWidth`, `borderColor` and `borderStyle` for a border. The colour (a
 * literal or a theme colour alias) is resolved against [variant]. A `none`
 * stroke becomes `{ borderWidth: 0 }` with no colour or style. Stroke styles
 * React Native cannot draw are unsupported (see {@link nativeStrokeStyle}).
 */
export function nativeBorder(border, variant, options = {}) {
    const path = options.path ?? 'border';
    const unsupported = [];
    const stroke = strokeStyle(border.style, `${path}.style`, unsupported);
    const style = stroke === 'none'
        ? { borderWidth: 0 }
        : {
            borderWidth: nativeDimension(border.width, options),
            borderColor: nativeColor(resolveTextureColor(variant, border.color)),
            borderStyle: stroke,
        };
    return finish(style, unsupported, options);
}
/**
 * Maps each shadow layer to a `boxShadow` entry, in order: offsets, blur as
 * `blurRadius`, spread as `spreadDistance`, `inset`, and the colour resolved
 * against [variant]. Every Aurora shadow is representable.
 */
export function nativeShadow(shadow, variant, options = {}) {
    const boxShadow = shadow.layers.map((layer) => {
        const entry = {
            offsetX: nativeDimension(layer.offsetX, options),
            offsetY: nativeDimension(layer.offsetY, options),
            blurRadius: nativeDimension(layer.blur, options),
            spreadDistance: nativeDimension(layer.spread, options),
            color: nativeColor(resolveTextureColor(variant, layer.color)),
        };
        if (layer.inset)
            entry.inset = true;
        return entry;
    });
    return { boxShadow: Object.freeze(boxShadow) };
}
function nativeFontWeight(value, path, unsupported) {
    if (!Number.isInteger(value) || value % 100 !== 0 || value < 100 || value > 900) {
        const clamped = Math.min(900, Math.max(100, Math.round(value / 100) * 100));
        unsupported.push({
            path,
            feature: 'fontWeight.step',
            message: `weight ${value} is not one of 100..900 in steps of 100; best-effort uses ${clamped}`,
        });
        return String(clamped);
    }
    return String(value);
}
/**
 * Typography as React Native text style fields. Font size and letter spacing are
 * dp (rem uses `remBase`). Aurora's line height is a multiplier of the font size
 * and is converted to absolute dp. Weights must be 100..900 in steps of 100;
 * others are unsupported (best-effort rounds to the nearest step). Only the
 * first font family is used unless `fontFamilyResolver` picks one; React Native
 * has no font fallback list. Loading fonts is the app's job.
 */
export function nativeTypography(typography, options = {}) {
    const path = options.path ?? 'typography';
    const unsupported = [];
    const weight = typography.fontWeight.value;
    const fontSize = nativeDimension(typography.fontSize, options);
    const style = {
        fontFamily: options.fontFamilyResolver?.(typography.fontFamily.names, weight) ?? typography.fontFamily.primary,
        fontSize,
        fontWeight: nativeFontWeight(weight, `${path}.fontWeight`, unsupported),
        lineHeight: Math.round(typography.lineHeight * fontSize * 1e4) / 1e4,
        letterSpacing: nativeDimension(typography.letterSpacing, options),
    };
    return finish(style, unsupported, options);
}
/** @internal Used by the texture view; unsupported reports default their path to the token path. */
export function createNativeTextureReader(read, variant) {
    return Object.freeze({
        color: (ref) => nativeColor(resolveTextureColor(variant, ref)),
        dimension: (token, options) => nativeDimension(read(token), options),
        borderRadius: (token, options) => nativeBorderRadius(read(token), options),
        duration: (token) => nativeDuration(read(token)),
        cubicBezier: (token) => nativeCubicBezier(read(token)),
        strokeStyle: (token, options) => nativeStrokeStyle(read(token), { path: token.path, ...options }),
        border: (token, options) => nativeBorder(read(token), variant, { path: token.path, ...options }),
        shadow: (token, options) => nativeShadow(read(token), variant, options),
        typography: (token, options) => nativeTypography(read(token), { path: token.path, ...options }),
    });
}
