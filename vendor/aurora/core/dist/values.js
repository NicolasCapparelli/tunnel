import { dartRound } from './mcu/utils.js';
import { refEquals, resolvedRef } from './ref.js';
/** An immutable length with an explicit unit. */
export class AuroraDimension {
    value;
    unit;
    kind = 'dimension';
    constructor(value, unit) {
        this.value = value;
        this.unit = unit;
        Object.freeze(this);
    }
    static dp(value) {
        return new AuroraDimension(value, 'dp');
    }
    static px(value) {
        return new AuroraDimension(value, 'px');
    }
    static rem(value) {
        return new AuroraDimension(value, 'rem');
    }
    equals(other) {
        return isKind(other, 'dimension') && other.value === this.value && other.unit === this.unit;
    }
    toString() {
        return `${this.value}${this.unit}`;
    }
}
/** An ordered, nonempty list of font family names, most preferred first. */
export class AuroraFontFamily {
    kind = 'fontFamily';
    names;
    constructor(names) {
        this.names = Object.freeze([...names]);
        Object.freeze(this);
    }
    static single(name) {
        return new AuroraFontFamily([name]);
    }
    /** The most preferred family; the remaining names are fallbacks. */
    get primary() {
        return this.names[0];
    }
    get fallbacks() {
        return this.names.slice(1);
    }
    equals(other) {
        return isKind(other, 'fontFamily') && listEquals(other.names, this.names);
    }
    toString() {
        return this.names.join(', ');
    }
}
/** A numeric font weight in [1, 1000]. */
export class AuroraFontWeight {
    value;
    kind = 'fontWeight';
    constructor(value) {
        this.value = value;
        Object.freeze(this);
    }
    static thin = new AuroraFontWeight(100);
    static extraLight = new AuroraFontWeight(200);
    static light = new AuroraFontWeight(300);
    static regular = new AuroraFontWeight(400);
    static medium = new AuroraFontWeight(500);
    static semiBold = new AuroraFontWeight(600);
    static bold = new AuroraFontWeight(700);
    static extraBold = new AuroraFontWeight(800);
    static black = new AuroraFontWeight(900);
    equals(other) {
        return isKind(other, 'fontWeight') && other.value === this.value;
    }
    toString() {
        return `${this.value}`;
    }
}
/**
 * A length of time with microsecond precision, matching Dart's `Duration`.
 * Fractional microseconds round half away from zero.
 */
export class AuroraDuration {
    kind = 'duration';
    microseconds;
    constructor(microseconds) {
        this.microseconds = dartRound(microseconds) + 0;
        Object.freeze(this);
    }
    static ms(milliseconds) {
        return new AuroraDuration(milliseconds * 1000);
    }
    static seconds(seconds) {
        return new AuroraDuration(seconds * 1000000);
    }
    get milliseconds() {
        return this.microseconds / 1000;
    }
    get isNegative() {
        return this.microseconds < 0;
    }
    equals(other) {
        return isKind(other, 'duration') && other.microseconds === this.microseconds;
    }
    toString() {
        return `${this.milliseconds}ms`;
    }
}
/**
 * An easing curve from (0, 0) to (1, 1) with control points (x1, y1) and
 * (x2, y2). The x coordinates must be in [0, 1].
 */
export class AuroraCubicBezier {
    x1;
    y1;
    x2;
    y2;
    kind = 'cubicBezier';
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        Object.freeze(this);
    }
    equals(other) {
        return (isKind(other, 'cubicBezier') &&
            other.x1 === this.x1 &&
            other.y1 === this.y1 &&
            other.x2 === this.x2 &&
            other.y2 === this.y2);
    }
    toString() {
        return `cubic-bezier(${this.x1}, ${this.y1}, ${this.x2}, ${this.y2})`;
    }
}
export const AURORA_STROKE_KEYWORDS = Object.freeze([
    'solid',
    'dashed',
    'dotted',
    'double',
    'groove',
    'ridge',
    'outset',
    'inset',
    'none',
]);
/** How a line is drawn: a keyword such as `solid`, or a dash pattern. */
export class AuroraStrokeStyle {
    kind = 'strokeStyle';
    /** Set for keyword styles; undefined for dash patterns. */
    keyword;
    /** Set for dash patterns; undefined for keyword styles. */
    lineCap;
    /** Authored dash entries, which may be aliases. Undefined for keyword styles. */
    dashArrayRefs;
    constructor(keyword, dashArray, lineCap) {
        this.keyword = keyword;
        this.dashArrayRefs = dashArray === undefined ? undefined : Object.freeze([...dashArray]);
        this.lineCap = lineCap;
        Object.freeze(this);
    }
    static keyword(keyword) {
        return new AuroraStrokeStyle(keyword, undefined, undefined);
    }
    /** A custom dash pattern: alternating dash and gap lengths. */
    static dashes(dashArray, lineCap) {
        return new AuroraStrokeStyle(undefined, [...dashArray], lineCap);
    }
    static solid = AuroraStrokeStyle.keyword('solid');
    static dashed = AuroraStrokeStyle.keyword('dashed');
    static dotted = AuroraStrokeStyle.keyword('dotted');
    static none = AuroraStrokeStyle.keyword('none');
    /** Resolved dash lengths. Undefined for keyword styles. */
    get dashArray() {
        return this.dashArrayRefs?.map((ref) => resolvedRef(ref, 'dashArray'));
    }
    get isNone() {
        return this.keyword === 'none';
    }
    equals(other) {
        return (isKind(other, 'strokeStyle') &&
            other.keyword === this.keyword &&
            other.lineCap === this.lineCap &&
            refListEquals(other.dashArrayRefs, this.dashArrayRefs));
    }
    toString() {
        return this.keyword ?? `dashes(${this.dashArrayRefs?.join(', ')}, ${this.lineCap})`;
    }
}
/**
 * A border. Its color is usually an alias to a theme colour token, such as
 * `new AuroraAlias(AuroraFoundation.outline)`, so it follows light and dark.
 */
export class AuroraBorder {
    kind = 'border';
    color;
    widthRef;
    styleRef;
    constructor(init) {
        this.color = init.color;
        this.widthRef = init.width;
        this.styleRef = init.style;
        Object.freeze(this);
    }
    get width() {
        return resolvedRef(this.widthRef, 'width');
    }
    get style() {
        return resolvedRef(this.styleRef, 'style');
    }
    equals(other) {
        return (isKind(other, 'border') &&
            refEquals(other.color, this.color) &&
            refEquals(other.widthRef, this.widthRef) &&
            refEquals(other.styleRef, this.styleRef));
    }
}
/** One shadow layer. Its color may alias a theme colour token. */
export class AuroraShadowLayer {
    kind = 'shadowLayer';
    color;
    offsetXRef;
    offsetYRef;
    blurRef;
    spreadRef;
    inset;
    constructor(init) {
        this.color = init.color;
        this.offsetXRef = init.offsetX;
        this.offsetYRef = init.offsetY;
        this.blurRef = init.blur;
        this.spreadRef = init.spread;
        this.inset = init.inset ?? false;
        Object.freeze(this);
    }
    get offsetX() {
        return resolvedRef(this.offsetXRef, 'offsetX');
    }
    get offsetY() {
        return resolvedRef(this.offsetYRef, 'offsetY');
    }
    get blur() {
        return resolvedRef(this.blurRef, 'blur');
    }
    get spread() {
        return resolvedRef(this.spreadRef, 'spread');
    }
    equals(other) {
        return (isKind(other, 'shadowLayer') &&
            refEquals(other.color, this.color) &&
            refEquals(other.offsetXRef, this.offsetXRef) &&
            refEquals(other.offsetYRef, this.offsetYRef) &&
            refEquals(other.blurRef, this.blurRef) &&
            refEquals(other.spreadRef, this.spreadRef) &&
            other.inset === this.inset);
    }
}
/** One or more shadow layers, drawn in order. An empty list means no shadow. */
export class AuroraShadow {
    kind = 'shadow';
    layers;
    constructor(layers) {
        this.layers = Object.freeze([...layers]);
        Object.freeze(this);
    }
    static none = new AuroraShadow([]);
    equals(other) {
        return isKind(other, 'shadow') && refListEquals(other.layers, this.layers);
    }
}
/** A text style. Any field may alias a token of that field's type. */
export class AuroraTypography {
    kind = 'typography';
    fontFamilyRef;
    fontSizeRef;
    fontWeightRef;
    letterSpacingRef;
    lineHeightRef;
    constructor(init) {
        this.fontFamilyRef = init.fontFamily;
        this.fontSizeRef = init.fontSize;
        this.fontWeightRef = init.fontWeight;
        this.letterSpacingRef = init.letterSpacing;
        this.lineHeightRef = init.lineHeight;
        Object.freeze(this);
    }
    get fontFamily() {
        return resolvedRef(this.fontFamilyRef, 'fontFamily');
    }
    get fontSize() {
        return resolvedRef(this.fontSizeRef, 'fontSize');
    }
    get fontWeight() {
        return resolvedRef(this.fontWeightRef, 'fontWeight');
    }
    get letterSpacing() {
        return resolvedRef(this.letterSpacingRef, 'letterSpacing');
    }
    get lineHeight() {
        return resolvedRef(this.lineHeightRef, 'lineHeight');
    }
    equals(other) {
        return (isKind(other, 'typography') &&
            refEquals(other.fontFamilyRef, this.fontFamilyRef) &&
            refEquals(other.fontSizeRef, this.fontSizeRef) &&
            refEquals(other.fontWeightRef, this.fontWeightRef) &&
            refEquals(other.letterSpacingRef, this.letterSpacingRef) &&
            refEquals(other.lineHeightRef, this.lineHeightRef));
    }
}
/** True when [value] is an Aurora value of [kind], checked without `instanceof`. */
export function isKind(value, kind) {
    return typeof value === 'object' && value !== null && value.kind === kind;
}
function listEquals(a, b) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
}
function refListEquals(a, b) {
    if (a === undefined || b === undefined)
        return a === b;
    return a.length === b.length && a.every((value, i) => refEquals(value, b[i]));
}
