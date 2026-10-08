import type { AuroraColor } from './color.js';
import { type AuroraRef } from './ref.js';
/** `dp` and `px` are logical pixels; `rem` is relative to the root font size. */
export type AuroraDimensionUnit = 'dp' | 'px' | 'rem';
/** An immutable length with an explicit unit. */
export declare class AuroraDimension {
    readonly value: number;
    readonly unit: AuroraDimensionUnit;
    readonly kind: "dimension";
    constructor(value: number, unit: AuroraDimensionUnit);
    static dp(value: number): AuroraDimension;
    static px(value: number): AuroraDimension;
    static rem(value: number): AuroraDimension;
    equals(other: unknown): boolean;
    toString(): string;
}
/** An ordered, nonempty list of font family names, most preferred first. */
export declare class AuroraFontFamily {
    readonly kind: "fontFamily";
    readonly names: readonly string[];
    constructor(names: Iterable<string>);
    static single(name: string): AuroraFontFamily;
    /** The most preferred family; the remaining names are fallbacks. */
    get primary(): string;
    get fallbacks(): readonly string[];
    equals(other: unknown): boolean;
    toString(): string;
}
/** A numeric font weight in [1, 1000]. */
export declare class AuroraFontWeight {
    readonly value: number;
    readonly kind: "fontWeight";
    constructor(value: number);
    static readonly thin: AuroraFontWeight;
    static readonly extraLight: AuroraFontWeight;
    static readonly light: AuroraFontWeight;
    static readonly regular: AuroraFontWeight;
    static readonly medium: AuroraFontWeight;
    static readonly semiBold: AuroraFontWeight;
    static readonly bold: AuroraFontWeight;
    static readonly extraBold: AuroraFontWeight;
    static readonly black: AuroraFontWeight;
    equals(other: unknown): boolean;
    toString(): string;
}
/**
 * A length of time with microsecond precision, matching Dart's `Duration`.
 * Fractional microseconds round half away from zero.
 */
export declare class AuroraDuration {
    readonly kind: "duration";
    readonly microseconds: number;
    constructor(microseconds: number);
    static ms(milliseconds: number): AuroraDuration;
    static seconds(seconds: number): AuroraDuration;
    get milliseconds(): number;
    get isNegative(): boolean;
    equals(other: unknown): boolean;
    toString(): string;
}
/**
 * An easing curve from (0, 0) to (1, 1) with control points (x1, y1) and
 * (x2, y2). The x coordinates must be in [0, 1].
 */
export declare class AuroraCubicBezier {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly kind: "cubicBezier";
    constructor(x1: number, y1: number, x2: number, y2: number);
    equals(other: unknown): boolean;
    toString(): string;
}
/** DTCG stroke style keywords, plus Aurora's `none`. */
export type AuroraStrokeKeyword = 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset' | 'none';
export declare const AURORA_STROKE_KEYWORDS: readonly AuroraStrokeKeyword[];
/** Line ends for a dash pattern. */
export type AuroraLineCap = 'round' | 'butt' | 'square';
/** How a line is drawn: a keyword such as `solid`, or a dash pattern. */
export declare class AuroraStrokeStyle {
    readonly kind: "strokeStyle";
    /** Set for keyword styles; undefined for dash patterns. */
    readonly keyword: AuroraStrokeKeyword | undefined;
    /** Set for dash patterns; undefined for keyword styles. */
    readonly lineCap: AuroraLineCap | undefined;
    /** Authored dash entries, which may be aliases. Undefined for keyword styles. */
    readonly dashArrayRefs: readonly AuroraRef<AuroraDimension>[] | undefined;
    private constructor();
    static keyword(keyword: AuroraStrokeKeyword): AuroraStrokeStyle;
    /** A custom dash pattern: alternating dash and gap lengths. */
    static dashes(dashArray: Iterable<AuroraRef<AuroraDimension>>, lineCap: AuroraLineCap): AuroraStrokeStyle;
    static readonly solid: AuroraStrokeStyle;
    static readonly dashed: AuroraStrokeStyle;
    static readonly dotted: AuroraStrokeStyle;
    static readonly none: AuroraStrokeStyle;
    /** Resolved dash lengths. Undefined for keyword styles. */
    get dashArray(): AuroraDimension[] | undefined;
    get isNone(): boolean;
    equals(other: unknown): boolean;
    toString(): string;
}
export interface AuroraBorderInit {
    /** A literal colour or an alias to a theme colour token. */
    color: AuroraRef<AuroraColor>;
    width: AuroraRef<AuroraDimension>;
    style: AuroraRef<AuroraStrokeStyle>;
}
/**
 * A border. Its color is usually an alias to a theme colour token, such as
 * `new AuroraAlias(AuroraFoundation.outline)`, so it follows light and dark.
 */
export declare class AuroraBorder {
    readonly kind: "border";
    readonly color: AuroraRef<AuroraColor>;
    readonly widthRef: AuroraRef<AuroraDimension>;
    readonly styleRef: AuroraRef<AuroraStrokeStyle>;
    constructor(init: AuroraBorderInit);
    get width(): AuroraDimension;
    get style(): AuroraStrokeStyle;
    equals(other: unknown): boolean;
}
export interface AuroraShadowLayerInit {
    color: AuroraRef<AuroraColor>;
    offsetX: AuroraRef<AuroraDimension>;
    offsetY: AuroraRef<AuroraDimension>;
    blur: AuroraRef<AuroraDimension>;
    spread: AuroraRef<AuroraDimension>;
    inset?: boolean;
}
/** One shadow layer. Its color may alias a theme colour token. */
export declare class AuroraShadowLayer {
    readonly kind: "shadowLayer";
    readonly color: AuroraRef<AuroraColor>;
    readonly offsetXRef: AuroraRef<AuroraDimension>;
    readonly offsetYRef: AuroraRef<AuroraDimension>;
    readonly blurRef: AuroraRef<AuroraDimension>;
    readonly spreadRef: AuroraRef<AuroraDimension>;
    readonly inset: boolean;
    constructor(init: AuroraShadowLayerInit);
    get offsetX(): AuroraDimension;
    get offsetY(): AuroraDimension;
    get blur(): AuroraDimension;
    get spread(): AuroraDimension;
    equals(other: unknown): boolean;
}
/** One or more shadow layers, drawn in order. An empty list means no shadow. */
export declare class AuroraShadow {
    readonly kind: "shadow";
    readonly layers: readonly AuroraShadowLayer[];
    constructor(layers: Iterable<AuroraShadowLayer>);
    static readonly none: AuroraShadow;
    equals(other: unknown): boolean;
}
export interface AuroraTypographyInit {
    fontFamily: AuroraRef<AuroraFontFamily>;
    fontSize: AuroraRef<AuroraDimension>;
    fontWeight: AuroraRef<AuroraFontWeight>;
    letterSpacing: AuroraRef<AuroraDimension>;
    /** A multiplier of the font size. */
    lineHeight: AuroraRef<number>;
}
/** A text style. Any field may alias a token of that field's type. */
export declare class AuroraTypography {
    readonly kind: "typography";
    readonly fontFamilyRef: AuroraRef<AuroraFontFamily>;
    readonly fontSizeRef: AuroraRef<AuroraDimension>;
    readonly fontWeightRef: AuroraRef<AuroraFontWeight>;
    readonly letterSpacingRef: AuroraRef<AuroraDimension>;
    readonly lineHeightRef: AuroraRef<number>;
    constructor(init: AuroraTypographyInit);
    get fontFamily(): AuroraFontFamily;
    get fontSize(): AuroraDimension;
    get fontWeight(): AuroraFontWeight;
    get letterSpacing(): AuroraDimension;
    get lineHeight(): number;
    equals(other: unknown): boolean;
}
interface Kinds {
    dimension: AuroraDimension;
    fontFamily: AuroraFontFamily;
    fontWeight: AuroraFontWeight;
    duration: AuroraDuration;
    cubicBezier: AuroraCubicBezier;
    strokeStyle: AuroraStrokeStyle;
    border: AuroraBorder;
    shadowLayer: AuroraShadowLayer;
    shadow: AuroraShadow;
    typography: AuroraTypography;
    color: AuroraColor;
}
/** True when [value] is an Aurora value of [kind], checked without `instanceof`. */
export declare function isKind<K extends keyof Kinds>(value: unknown, kind: K): value is Kinds[K];
export {};
