/**
 * A typed, documented field in an Aurora contract. Declare tokens once as
 * module constants, then reuse those declarations for values and reads.
 * Membership in a contract is by identity, so a token must be the same object
 * everywhere it is used.
 *
 * Colour tokens belong to theme contracts. Every other type belongs to texture
 * contracts.
 */
export class AuroraToken {
    kind = 'token';
    path;
    description;
    constructor(path, options) {
        this.path = path;
        this.description = options.description;
    }
    toString() {
        return this.path;
    }
}
/** A typed color field. */
export class AuroraColorToken extends AuroraToken {
    type = 'color';
}
/** A length, such as a corner radius, border width or padding. */
export class AuroraDimensionToken extends AuroraToken {
    type = 'dimension';
}
/** A unitless finite number, such as an elevation level or opacity. */
export class AuroraNumberToken extends AuroraToken {
    type = 'number';
}
/** An ordered list of font family names, most preferred first. */
export class AuroraFontFamilyToken extends AuroraToken {
    type = 'fontFamily';
}
/** A numeric font weight in [1, 1000]. */
export class AuroraFontWeightToken extends AuroraToken {
    type = 'fontWeight';
}
/** A nonnegative length of time, such as an animation duration. */
export class AuroraDurationToken extends AuroraToken {
    type = 'duration';
}
/** An easing curve, defined by two cubic Bézier control points. */
export class AuroraCubicBezierToken extends AuroraToken {
    type = 'cubicBezier';
}
/** How a line is drawn: solid, dashed, dotted, none, or a dash pattern. */
export class AuroraStrokeStyleToken extends AuroraToken {
    type = 'strokeStyle';
}
/** A border: colour, width and stroke style. */
export class AuroraBorderToken extends AuroraToken {
    type = 'border';
}
/** One or more shadow layers. */
export class AuroraShadowToken extends AuroraToken {
    type = 'shadow';
}
/** A text style: family, size, weight, letter spacing and line height. */
export class AuroraTypographyToken extends AuroraToken {
    type = 'typography';
}
/** An on/off switch. Encoded as an Aurora DTCG extension. */
export class AuroraBooleanToken extends AuroraToken {
    type = 'boolean';
}
/**
 * One of a fixed set of string values, such as a default component layout. A
 * value outside the set is a validation error.
 */
export class AuroraEnumToken extends AuroraToken {
    type = 'enum';
    values;
    constructor(path, options) {
        super(path, options);
        this.values = Object.freeze([...options.values]);
    }
}
/** A token of [type] with no contract meaning, used to name field kinds. */
export function tokenOfType(type, path, description) {
    const options = { description };
    switch (type) {
        case 'color':
            return new AuroraColorToken(path, options);
        case 'dimension':
            return new AuroraDimensionToken(path, options);
        case 'number':
            return new AuroraNumberToken(path, options);
        case 'fontFamily':
            return new AuroraFontFamilyToken(path, options);
        case 'fontWeight':
            return new AuroraFontWeightToken(path, options);
        case 'duration':
            return new AuroraDurationToken(path, options);
        case 'cubicBezier':
            return new AuroraCubicBezierToken(path, options);
        case 'strokeStyle':
            return new AuroraStrokeStyleToken(path, options);
        case 'border':
            return new AuroraBorderToken(path, options);
        case 'shadow':
            return new AuroraShadowToken(path, options);
        case 'typography':
            return new AuroraTypographyToken(path, options);
        case 'boolean':
            return new AuroraBooleanToken(path, options);
        case 'enum':
            return new AuroraEnumToken(path, { description, values: [] });
    }
}
