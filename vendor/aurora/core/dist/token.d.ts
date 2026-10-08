import type { AuroraColor } from './color.js';
import type { AuroraBorder, AuroraCubicBezier, AuroraDimension, AuroraDuration, AuroraFontFamily, AuroraFontWeight, AuroraShadow, AuroraStrokeStyle, AuroraTypography } from './values.js';
/** The DTCG `$type`, or Aurora's extension type for `boolean` and `enum`. */
export type AuroraTokenType = 'color' | 'dimension' | 'number' | 'fontFamily' | 'fontWeight' | 'duration' | 'cubicBezier' | 'strokeStyle' | 'border' | 'shadow' | 'typography' | 'boolean' | 'enum';
export interface AuroraTokenOptions {
    description: string;
}
/**
 * A typed, documented field in an Aurora contract. Declare tokens once as
 * module constants, then reuse those declarations for values and reads.
 * Membership in a contract is by identity, so a token must be the same object
 * everywhere it is used.
 *
 * Colour tokens belong to theme contracts. Every other type belongs to texture
 * contracts.
 */
export declare abstract class AuroraToken<T> {
    readonly kind: "token";
    abstract readonly type: AuroraTokenType;
    readonly path: string;
    readonly description: string;
    /** Carries the value type for typed reads; never set at runtime. */
    readonly __value?: T;
    constructor(path: string, options: AuroraTokenOptions);
    toString(): string;
}
/** The value type a token holds. */
export type AuroraTokenValue<K> = K extends AuroraToken<infer T> ? T : never;
/** A typed color field. */
export declare class AuroraColorToken extends AuroraToken<AuroraColor> {
    readonly type: "color";
}
/** A length, such as a corner radius, border width or padding. */
export declare class AuroraDimensionToken extends AuroraToken<AuroraDimension> {
    readonly type: "dimension";
}
/** A unitless finite number, such as an elevation level or opacity. */
export declare class AuroraNumberToken extends AuroraToken<number> {
    readonly type: "number";
}
/** An ordered list of font family names, most preferred first. */
export declare class AuroraFontFamilyToken extends AuroraToken<AuroraFontFamily> {
    readonly type: "fontFamily";
}
/** A numeric font weight in [1, 1000]. */
export declare class AuroraFontWeightToken extends AuroraToken<AuroraFontWeight> {
    readonly type: "fontWeight";
}
/** A nonnegative length of time, such as an animation duration. */
export declare class AuroraDurationToken extends AuroraToken<AuroraDuration> {
    readonly type: "duration";
}
/** An easing curve, defined by two cubic Bézier control points. */
export declare class AuroraCubicBezierToken extends AuroraToken<AuroraCubicBezier> {
    readonly type: "cubicBezier";
}
/** How a line is drawn: solid, dashed, dotted, none, or a dash pattern. */
export declare class AuroraStrokeStyleToken extends AuroraToken<AuroraStrokeStyle> {
    readonly type: "strokeStyle";
}
/** A border: colour, width and stroke style. */
export declare class AuroraBorderToken extends AuroraToken<AuroraBorder> {
    readonly type: "border";
}
/** One or more shadow layers. */
export declare class AuroraShadowToken extends AuroraToken<AuroraShadow> {
    readonly type: "shadow";
}
/** A text style: family, size, weight, letter spacing and line height. */
export declare class AuroraTypographyToken extends AuroraToken<AuroraTypography> {
    readonly type: "typography";
}
/** An on/off switch. Encoded as an Aurora DTCG extension. */
export declare class AuroraBooleanToken extends AuroraToken<boolean> {
    readonly type: "boolean";
}
export interface AuroraEnumTokenOptions<V extends string> extends AuroraTokenOptions {
    values: readonly V[];
}
/**
 * One of a fixed set of string values, such as a default component layout. A
 * value outside the set is a validation error.
 */
export declare class AuroraEnumToken<V extends string = string> extends AuroraToken<V> {
    readonly type: "enum";
    readonly values: readonly V[];
    constructor(path: string, options: AuroraEnumTokenOptions<V>);
}
/** Every concrete texture token class (all token types except colour). */
export type AuroraTextureTokenAny = AuroraDimensionToken | AuroraNumberToken | AuroraFontFamilyToken | AuroraFontWeightToken | AuroraDurationToken | AuroraCubicBezierToken | AuroraStrokeStyleToken | AuroraBorderToken | AuroraShadowToken | AuroraTypographyToken | AuroraBooleanToken | AuroraEnumToken;
/** Every concrete token class. */
export type AuroraAnyToken = AuroraColorToken | AuroraTextureTokenAny;
/** A token of [type] with no contract meaning, used to name field kinds. */
export declare function tokenOfType(type: AuroraTokenType, path: string, description: string): AuroraAnyToken;
